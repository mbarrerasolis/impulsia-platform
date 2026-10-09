import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { crossedBudgetWarning, evaluateAssistantGuards, type AssistantLimits } from "@/domain/messaging/assistant-guards";
import {
  advanceLeadQualification,
  qualificationContextSchema,
  qualificationStateSchema,
} from "@/domain/messaging/lead-qualification-bot";
import { mediaFromStoredMessage, whatsAppReferralSchema, type InboundWhatsAppMessage } from "@/integrations/whatsapp/webhook";
import type { VoiceProvider } from "@/integrations/audio/openai-audio";
import { attributionFromRefCode, attributionFromWhatsAppReferral } from "@/domain/marketing/attribution";
import type { DownloadedMedia } from "@/integrations/whatsapp/whatsapp-cloud-provider";
import { assistantInterestScores, interestSignalScores } from "@/domain/crm/lead-temperature";
import { toJson } from "@/lib/supabase/json";
import type { Database } from "@/lib/supabase/database.types";
import { getAssistantActivity, recordAiUsage } from "./ai-usage";
import type { MeetingScheduler } from "./meeting-scheduler";
import type { AssistantAttachment, AssistantHistoryMessage, AssistantLeadInput, AssistantMeeting, AssistantQuoteProposal, ConversationAssistant, HandoffPriority } from "./sales-assistant";
import { attachmentFromMedia, mediaLimits, replyNeedsTextCopy, textForSpeech, transcribeVoiceNote } from "./whatsapp-media";

type AdminClient = SupabaseClient<Database>;

/** Lo que el procesador necesita del canal para responder; WhatsApp además puede mandar notas de voz. */
export interface ConversationSender {
  sendText(to: string, body: string): Promise<string>;
  downloadMedia(mediaId: string, maxBytes: number): Promise<DownloadedMedia>;
  uploadMedia?(data: Buffer, mimeType: string, filename: string): Promise<string>;
  sendAudio?(to: string, mediaId: string, voice?: boolean): Promise<string>;
}

/** Diferencias entre canales de mensajería que comparten el mismo flujo con el asistente. */
export interface MessagingChannel {
  kind: "whatsapp" | "instagram";
  /** `channels.provider`; el id externo es el número (WhatsApp) o la cuenta (Instagram) que recibe. */
  provider: "meta_whatsapp" | "meta_instagram";
  /** En WhatsApp el remitente es su teléfono; en Instagram es un id interno de Meta. */
  senderIsPhone: boolean;
}

export const whatsAppChannel: MessagingChannel = { kind: "whatsapp", provider: "meta_whatsapp", senderIsPhone: true };
export const instagramChannel: MessagingChannel = { kind: "instagram", provider: "meta_instagram", senderIsPhone: false };
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];

export interface WhatsAppAssistantRuntime {
  assistant: ConversationAssistant;
  model: string;
  limits: AssistantLimits;
  scheduler?: MeetingScheduler | null;
  appUrl?: string;
  /** Transcribe notas de voz y genera respuestas habladas; sin él, los audios quedan sin transcribir. */
  voice?: VoiceProvider | null;
  /** Responder con nota de voz cuando el cliente habló por audio. */
  voiceReplies?: boolean;
}

/** Hechos del procesamiento que la ruta usa para avisar al equipo después de responder a Meta. */
export interface WhatsAppInboundOutcome {
  /** Canal de la conversación; sin valor, WhatsApp. */
  channel?: "whatsapp" | "web" | "instagram";
  duplicate: boolean;
  /** El mensaje quedó guardado y la IA responderá después (ver `answerDeferredWhatsApp`). */
  deferred?: boolean;
  conversationId: string;
  leadId?: string | null;
  lead?: AssistantLeadInput;
  handoff?: { reason: string; priority: HandoffPriority } | null;
  quoteProposal?: AssistantQuoteProposal | null;
  meeting?: AssistantMeeting | null;
  budgetWarning?: { spentUsd: number; budgetUsd: number };
}

/** Estado propio del asistente de IA dentro de `conversations.bot_context`. */
const assistantBotContextSchema = z.object({
  assistant: z.object({
    quoteProposals: z.number().int().nonnegative().default(0),
    meetings: z.number().int().nonnegative().default(0),
    followUps: z.object({
      count: z.number().int().nonnegative().default(0),
      lastForInboundAt: z.string().optional(),
    }).default({ count: 0 }),
  }).optional(),
});

export type AssistantBotState = z.infer<typeof assistantBotContextSchema>["assistant"] & {};

export function readAssistantState(botContext: unknown): AssistantBotState {
  const parsed = assistantBotContextSchema.safeParse(botContext);
  return parsed.success && parsed.data.assistant ? parsed.data.assistant : { quoteProposals: 0, meetings: 0, followUps: { count: 0 } };
}

/** Reemplaza el estado del asistente conservando el resto de `bot_context`. */
export function withAssistantState(botContext: unknown, assistant: AssistantBotState) {
  const rest = botContext && typeof botContext === "object" && !Array.isArray(botContext) ? botContext : {};
  return toJson({ ...rest, assistant });
}

async function getOrCreateChannel(client: AdminClient, channel: MessagingChannel, phoneNumberId: string) {
  const existing = await client.from("channels").select("id").eq("provider", channel.provider).eq("external_identifier", phoneNumberId).maybeSingle();
  if (existing.error) throw new Error(`No fue posible buscar el canal de WhatsApp: ${existing.error.message}`);
  if (existing.data) return existing.data.id;

  const inserted = await client.from("channels").insert({
    type: channel.kind,
    provider: channel.provider,
    status: "connected",
    external_identifier: phoneNumberId,
  }).select("id").single();
  if (!inserted.error) return inserted.data.id;
  if (inserted.error.code !== "23505") throw new Error(`No fue posible crear el canal de WhatsApp: ${inserted.error.message}`);

  const raced = await client.from("channels").select("id").eq("provider", channel.provider).eq("external_identifier", phoneNumberId).single();
  if (raced.error) throw new Error(`No fue posible recuperar el canal de WhatsApp: ${raced.error.message}`);
  return raced.data.id;
}

async function getOrCreateConversation(client: AdminClient, channelId: string, message: InboundWhatsAppMessage) {
  const existing = await client.from("conversations").select("*")
    .eq("channel_id", channelId)
    .eq("external_participant_id", message.sender)
    .maybeSingle();
  if (existing.error) throw new Error(`No fue posible buscar la conversación: ${existing.error.message}`);
  if (existing.data) return existing.data;

  const inserted = await client.from("conversations").insert({
    channel_id: channelId,
    external_participant_id: message.sender,
    profile_name: message.profileName ?? null,
    status: "open",
    qualification_state: "new",
    bot_context: {},
    last_message_at: message.sentAt,
  }).select("*").single();
  if (!inserted.error) return inserted.data;
  if (inserted.error.code !== "23505") throw new Error(`No fue posible crear la conversación: ${inserted.error.message}`);

  const raced = await client.from("conversations").select("*")
    .eq("channel_id", channelId)
    .eq("external_participant_id", message.sender)
    .single();
  if (raced.error) throw new Error(`No fue posible recuperar la conversación: ${raced.error.message}`);
  return raced.data;
}

/** Genera la nota de voz y la envía; devuelve su id y costo, o null si falla (se responde por texto). */
async function sendVoiceReply(provider: ConversationSender, voice: VoiceProvider, to: string, reply: string) {
  if (!provider.uploadMedia || !provider.sendAudio) return null;
  try {
    const speech = await voice.synthesize(textForSpeech(reply));
    const mediaId = await provider.uploadMedia(speech.data, speech.mimeType, "respuesta.ogg");
    return { externalId: await provider.sendAudio(to, mediaId), costUsd: speech.costUsd };
  } catch (error) {
    console.error("whatsapp.voice.reply_failed", { message: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}

/**
 * Envía la respuesta y la guarda; si Meta falla, la conversación queda para atención humana en vez de reintentar a ciegas.
 * Con `voice`, va como nota de voz y, si trae enlaces, montos u horarios, también por escrito. Devuelve el costo de la voz.
 */
async function sendReply(client: AdminClient, provider: ConversationSender, conversationId: string, message: InboundWhatsAppMessage, reply: string, voice?: VoiceProvider | null) {
  try {
    const sentAt = new Date().toISOString();
    const spoken = voice ? await sendVoiceReply(provider, voice, message.sender, reply) : null;
    const textCopy = spoken && replyNeedsTextCopy(reply);
    const externalId = spoken ? spoken.externalId : await provider.sendText(message.sender, reply);
    const outbound = await client.from("messages").insert({
      conversation_id: conversationId,
      external_id: externalId,
      direction: "outbound",
      sender_ref: message.phoneNumberId,
      body: reply,
      message_type: spoken ? "audio" : "text",
      sent_at: sentAt,
      delivery_status: "sent",
      metadata: spoken ? { voiceReply: true, textCopy: Boolean(textCopy) } : {},
    });
    if (outbound.error) throw new Error(outbound.error.message);
    // Enlaces, montos u horarios también por escrito; esa copia no se guarda aparte porque la nota ya tiene el texto.
    if (textCopy) {
      await provider.sendText(message.sender, reply).catch((error: unknown) => {
        console.error("whatsapp.voice.text_copy_failed", { message: error instanceof Error ? error.message : "unknown" });
      });
    }
    return spoken?.costUsd ?? 0;
  } catch (error) {
    console.error("whatsapp.reply.failed", { message: error instanceof Error ? error.message : "unknown" });
    await client.from("conversations").update({
      status: "waiting_human",
      human_handoff_requested: true,
    }).eq("id", conversationId);
    return 0;
  }
}

/** Sube el score del lead hasta `minimum` sin bajarlo nunca; un fallo no interrumpe la conversación. */
/**
 * Origen del anuncio que abrió la conversación (Click-to-WhatsApp). Meta lo manda sólo en el primer mensaje desde el
 * anuncio, así que si el mensaje actual no lo trae se busca en los mensajes guardados de la conversación. Sin anuncio,
 * se usa el código "[ref: …]" del texto prellenado de un enlace del sitio (campañas de correo, landings).
 */
async function adAttribution(client: AdminClient, conversationId: string, message: InboundWhatsAppMessage) {
  if (message.referral) return attributionFromWhatsAppReferral(message.referral, message.sentAt);
  return await referralFromHistory(client, conversationId) ?? attributionFromRefCode(message.body, message.sentAt) ?? await refCodeFromHistory(client, conversationId);
}

async function refCodeFromHistory(client: AdminClient, conversationId: string) {
  const earlier = await client.from("messages").select("body, sent_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .ilike("body", "%[ref:%")
    .order("sent_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (earlier.error) {
    console.warn("whatsapp.ref_code.lookup_failed", { conversationId, error: earlier.error.message });
    return undefined;
  }
  return earlier.data ? attributionFromRefCode(earlier.data.body, earlier.data.sent_at) : undefined;
}

async function referralFromHistory(client: AdminClient, conversationId: string) {
  const earlier = await client.from("messages").select("metadata, sent_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .not("metadata->referral", "is", null)
    .order("sent_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (earlier.error) {
    console.warn("whatsapp.referral.lookup_failed", { conversationId, error: earlier.error.message });
    return undefined;
  }
  const metadata = earlier.data?.metadata as { referral?: unknown } | null | undefined;
  const referral = whatsAppReferralSchema.safeParse(metadata?.referral);
  return referral.success && earlier.data ? attributionFromWhatsAppReferral(referral.data, earlier.data.sent_at) : undefined;
}

/** Si alguien que ya es lead vuelve a escribir desde un anuncio y su lead no tenía origen, se le asigna. */
async function attributeExistingLead(client: AdminClient, leadId: string | null, message: InboundWhatsAppMessage) {
  const attribution = leadId ? attributionFromWhatsAppReferral(message.referral, message.sentAt) : undefined;
  if (!leadId || !attribution) return;
  const updated = await client.from("leads").update({ attribution: toJson(attribution) }).eq("id", leadId).is("attribution", null);
  if (updated.error) console.warn("whatsapp.referral.attribute_failed", { leadId, error: updated.error.message });
}

async function raiseLeadScore(client: AdminClient, leadId: string, minimum: number) {
  const { error } = await client.from("leads").update({ score: minimum }).eq("id", leadId).lt("score", minimum);
  if (error) console.error("lead.score.raise_failed", { leadId, message: error.message });
}

async function loadAssistantHistory(client: AdminClient, conversationId: string, currentExternalId: string): Promise<AssistantHistoryMessage[]> {
  const { data, error } = await client.from("messages").select("direction, body, external_id")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(21);
  if (error) throw new Error(`No fue posible leer el historial de la conversación: ${error.message}`);
  return data
    .filter((row) => row.external_id !== currentExternalId && row.body && (row.direction === "inbound" || row.direction === "outbound"))
    .reverse()
    .map((row) => ({ direction: row.direction as AssistantHistoryMessage["direction"], body: row.body ?? "" }));
}

async function answerWithAssistant(input: {
  client: AdminClient;
  message: InboundWhatsAppMessage;
  conversation: ConversationRow;
  provider: ConversationSender;
  runtime: WhatsAppAssistantRuntime;
  channel: MessagingChannel;
  attachments?: AssistantAttachment[];
  replyFormat?: "text" | "voice";
  /** Costo ya gastado en este turno fuera del modelo (transcripciones). */
  mediaCostUsd?: number;
}): Promise<WhatsAppInboundOutcome> {
  const { client, message, conversation, provider, runtime, channel } = input;
  const voiceReply = input.replyFormat === "voice" && runtime.voice ? runtime.voice : null;
  const profileName = message.profileName ?? conversation.profile_name;
  const touch = { last_message_at: message.sentAt, profile_name: profileName };

  // Una persona ya tomó la conversación (o se cerró): la IA no interviene.
  if (conversation.status === "waiting_human" || conversation.status === "closed") {
    const updated = await client.from("conversations").update(touch).eq("id", conversation.id);
    if (updated.error) throw new Error(`No fue posible actualizar la conversación: ${updated.error.message}`);
    return { duplicate: false, conversationId: conversation.id, leadId: conversation.lead_id };
  }

  const activity = await getAssistantActivity(client, { conversationId: conversation.id, sender: message.sender });
  const guard = evaluateAssistantGuards(activity, runtime.limits);
  if (!guard.allowed) {
    console.warn("assistant.guard.blocked", { conversationId: conversation.id, reason: guard.reason });
    const updated = await client.from("conversations").update({
      ...touch,
      ...(guard.handoff ? { status: "waiting_human", qualification_state: "waiting_human", human_handoff_requested: true } : {}),
    }).eq("id", conversation.id);
    if (updated.error) throw new Error(`No fue posible actualizar la conversación: ${updated.error.message}`);
    if (guard.reply) await sendReply(client, provider, conversation.id, message, guard.reply);
    const reasons = { sender_rate_day: "El contacto superó el máximo de mensajes diarios.", conversation_cap: "La conversación alcanzó el máximo de respuestas automáticas del día.", daily_budget: "Se alcanzó el presupuesto diario del asistente con IA." } as const;
    return {
      duplicate: false,
      conversationId: conversation.id,
      leadId: conversation.lead_id,
      handoff: guard.handoff && guard.reason !== "sender_rate_minute" ? { reason: reasons[guard.reason], priority: "normal" } : null,
    };
  }

  let lead: WhatsAppInboundOutcome["lead"];
  const assistantState = readAssistantState(conversation.bot_context);
  const scheduler = runtime.scheduler;
  const result = await runtime.assistant.runTurn({
    history: await loadAssistantHistory(client, conversation.id, message.externalId),
    channel: channel.kind,
    message: message.body,
    attachments: input.attachments,
    replyFormat: voiceReply ? "voice" : "text",
    profileName: profileName ?? undefined,
    existingLeadId: conversation.lead_id,
    conversationId: conversation.id,
    ...(channel.senderIsPhone ? { contactPhone: `+${message.sender.replace(/^\+/, "")}` } : {}),
    quoteProposalsSent: assistantState.quoteProposals,
    meetingsScheduled: assistantState.meetings,
  }, {
    registerLead: async (data) => {
      const attribution = await adAttribution(client, conversation.id, message);
      const inserted = await client.from("leads").insert({
        source: channel.kind,
        attribution: attribution ? toJson(attribution) : null,
        name: data.name,
        company: data.company,
        email: data.email,
        phone: channel.senderIsPhone ? message.sender : data.phone ?? null,
        raw_need_description: data.need,
        systems: data.systems,
        api_knowledge: "unknown",
        primary_goal: data.goal,
        consent_given: true,
        status: "new",
        score: assistantInterestScores[data.interest],
      }).select("id").single();
      if (inserted.error) throw new Error(`No fue posible crear el lead de WhatsApp: ${inserted.error.message}`);
      const linked = await client.from("conversations").update({ lead_id: inserted.data.id }).eq("id", conversation.id);
      if (linked.error) throw new Error(`No fue posible vincular el lead: ${linked.error.message}`);
      lead = { ...data, ...(channel.senderIsPhone ? { phone: message.sender } : {}) };
      return { leadId: inserted.data.id };
    },
    // La derivación se aplica al actualizar la conversación más abajo, junto con el resto del estado.
    requestHandoff: async () => {},
    // La propuesta se avisa por correo al equipo y el contador se guarda al actualizar la conversación.
    proposeQuote: async () => {},
    ...(scheduler ? {
      listMeetingSlots: () => scheduler.listSlots(),
      scheduleMeeting: async ({ leadId, start, topic }: { leadId: string; start: Date; topic: string }) => {
        const found = await client.from("leads").select("name, company, email").eq("id", leadId).single();
        if (found.error) throw new Error(`No fue posible leer el lead para agendar: ${found.error.message}`);
        const booked = await scheduler.book({
          start,
          topic,
          attendeeEmail: found.data.email,
          attendeeName: found.data.name,
          company: found.data.company,
          conversationUrl: runtime.appUrl ? `${runtime.appUrl}/admin/conversations/${conversation.id}` : undefined,
          idempotencyKey: `${conversation.id}:meeting:${assistantState.meetings + 1}`,
        });
        return booked.ok ? { ok: true as const, meetLink: booked.event.meetLink } : booked;
      },
    } : {}),
  });


  const status = result.handoff ? "waiting_human" : result.leadId ? "qualified" : "bot_qualifying";
  const updated = await client.from("conversations").update({
    ...touch,
    status,
    qualification_state: result.handoff ? "waiting_human" : result.leadId ? "qualified" : "ai_conversation",
    human_handoff_requested: Boolean(result.handoff || result.leadId),
    lead_id: result.leadId,
    ...(result.quoteProposal || result.meeting ? { bot_context: withAssistantState(conversation.bot_context, {
      ...assistantState,
      quoteProposals: assistantState.quoteProposals + (result.quoteProposal ? 1 : 0),
      meetings: assistantState.meetings + (result.meeting ? 1 : 0),
    }) } : {}),
  }).eq("id", conversation.id);
  if (updated.error) throw new Error(`No fue posible avanzar la conversación: ${updated.error.message}`);

  const voiceCostUsd = await sendReply(client, provider, conversation.id, message, result.reply, voiceReply);
  const turnCostUsd = result.costUsd + voiceCostUsd + (input.mediaCostUsd ?? 0);
  await recordAiUsage(client, { conversationId: conversation.id, purpose: channel.kind, model: runtime.model, usage: result.usage, modelCalls: result.modelCalls, costUsd: turnCostUsd });

  // Pedir cotización o agendar son señales fuertes de interés: el lead sube a caliente.
  const signalScore = result.meeting ? interestSignalScores.meeting : result.quoteProposal ? interestSignalScores.quoteProposal : null;
  if (signalScore && result.leadId) await raiseLeadScore(client, result.leadId, signalScore);

  const spentAfter = activity.spentLast24hUsd + turnCostUsd;
  return {
    channel: channel.kind,
    duplicate: false,
    conversationId: conversation.id,
    leadId: result.leadId,
    lead,
    handoff: result.handoff,
    quoteProposal: result.quoteProposal,
    meeting: result.meeting,
    ...(crossedBudgetWarning(activity.spentLast24hUsd, spentAfter, runtime.limits.dailyBudgetUsd)
      ? { budgetWarning: { spentUsd: spentAfter, budgetUsd: runtime.limits.dailyBudgetUsd } }
      : {}),
  };
}

export async function processWhatsAppInbound(input: {
  client: AdminClient;
  message: InboundWhatsAppMessage;
  botEnabled: boolean;
  provider?: ConversationSender;
  brandName?: string;
  /** Con asistente configurado, la IA reemplaza al guion determinista. */
  assistant?: WhatsAppAssistantRuntime;
  /** WhatsApp por defecto. */
  channel?: MessagingChannel;
}): Promise<WhatsAppInboundOutcome> {
  const channel = input.channel ?? whatsAppChannel;
  const channelId = await getOrCreateChannel(input.client, channel, input.message.phoneNumberId);
  const conversation = await getOrCreateConversation(input.client, channelId, input.message);
  const stored = await input.client.from("messages").insert({
    conversation_id: conversation.id,
    external_id: input.message.externalId,
    direction: "inbound",
    sender_ref: input.message.sender,
    body: input.message.body,
    message_type: input.message.type,
    sent_at: input.message.sentAt,
    delivery_status: "received",
    metadata: toJson(input.message.raw),
  });
  if (stored.error?.code === "23505") return { duplicate: true, conversationId: conversation.id };
  if (stored.error) throw new Error(`No fue posible guardar el mensaje de WhatsApp: ${stored.error.message}`);
  await attributeExistingLead(input.client, conversation.lead_id, input.message);

  if (!input.botEnabled || !input.provider) {
    const updated = await input.client.from("conversations").update({
      last_message_at: input.message.sentAt,
      profile_name: input.message.profileName ?? conversation.profile_name,
    }).eq("id", conversation.id);
    if (updated.error) throw new Error(`No fue posible actualizar la conversación: ${updated.error.message}`);
    return { duplicate: false, conversationId: conversation.id };
  }

  // La IA responde después de contestarle a Meta: así puede transcribir audios y esperar mensajes seguidos sin que Meta reintente.
  if (input.assistant) return { channel: channel.kind, duplicate: false, deferred: true, conversationId: conversation.id, leadId: conversation.lead_id };

  const parsedState = qualificationStateSchema.safeParse(conversation.qualification_state);
  const qualification = advanceLeadQualification({
    state: parsedState.success ? parsedState.data : "new",
    context: qualificationContextSchema.parse(conversation.bot_context),
    message: input.message.body,
    profileName: input.message.profileName ?? conversation.profile_name ?? undefined,
    phone: input.message.sender,
    brandName: input.brandName,
  });

  let leadId = conversation.lead_id;
  if (qualification.lead && !leadId) {
    const attribution = await adAttribution(input.client, conversation.id, input.message);
    const lead = await input.client.from("leads").insert({
      source: "whatsapp",
      attribution: attribution ? toJson(attribution) : null,
      name: qualification.lead.name,
      company: qualification.lead.company,
      email: qualification.lead.email,
      phone: qualification.lead.phone,
      raw_need_description: qualification.lead.rawNeedDescription,
      systems: [],
      api_knowledge: "unknown",
      primary_goal: qualification.lead.primaryGoal,
      consent_given: true,
      status: "new",
      score: 50,
    }).select("id").single();
    if (lead.error) throw new Error(`No fue posible crear el lead de WhatsApp: ${lead.error.message}`);
    leadId = lead.data.id;
  }

  const conversationStatus = qualification.state === "qualified"
    ? "qualified"
    : qualification.state === "waiting_human"
      ? "waiting_human"
      : qualification.state === "closed"
        ? "closed"
        : "bot_qualifying";
  const updated = await input.client.from("conversations").update({
    status: conversationStatus,
    qualification_state: qualification.state,
    bot_context: toJson(qualification.context),
    human_handoff_requested: qualification.humanHandoffRequested,
    last_message_at: input.message.sentAt,
    profile_name: input.message.profileName ?? conversation.profile_name,
    lead_id: leadId,
  }).eq("id", conversation.id);
  if (updated.error) throw new Error(`No fue posible avanzar la conversación: ${updated.error.message}`);

  if (qualification.reply) {
    await sendReply(input.client, input.provider, conversation.id, input.message, qualification.reply);
  }

  return { duplicate: false, conversationId: conversation.id, leadId };
}

const pendingVoiceBody = "[Nota de voz sin transcribir]";

/** Transcribe la nota de voz y reemplaza el texto provisional guardado; devuelve el costo. */
async function storeTranscription(client: AdminClient, provider: ConversationSender, voice: VoiceProvider | null | undefined, conversationId: string, externalId: string, raw: unknown) {
  const media = mediaFromStoredMessage(raw);
  if (!media || media.kind !== "audio") return { body: null, costUsd: 0 };
  const transcription = await transcribeVoiceNote(provider, voice, media);
  if (!transcription) return { body: null, costUsd: 0 };
  const updated = await client.from("messages").update({ body: transcription.body })
    .eq("conversation_id", conversationId).eq("external_id", externalId).eq("body", pendingVoiceBody);
  if (updated.error) console.warn("whatsapp.voice.store_failed", { conversationId, error: updated.error.message });
  return { body: transcription.body, costUsd: transcription.costUsd };
}

/**
 * Responde con IA un mensaje ya guardado. Transcribe su nota de voz, espera `batchMs` y, si el cliente siguió escribiendo,
 * no responde: lo hará el último mensaje, que contesta todo junto (los mensajes seguidos se unen en el historial).
 * Las imágenes y PDF de los mensajes sin responder se le muestran al modelo en este turno.
 */
export async function answerDeferredWhatsApp(input: {
  client: AdminClient;
  message: InboundWhatsAppMessage;
  conversationId: string;
  provider: ConversationSender;
  runtime: WhatsAppAssistantRuntime;
  batchMs: number;
  channel?: MessagingChannel;
}): Promise<WhatsAppInboundOutcome | null> {
  const { client, message, conversationId, provider, runtime } = input;
  const channel = input.channel ?? whatsAppChannel;
  let mediaCostUsd = 0;
  if (message.media?.kind === "audio") {
    const own = await storeTranscription(client, provider, runtime.voice, conversationId, message.externalId, message.raw);
    mediaCostUsd += own.costUsd;
  }

  if (input.batchMs > 0) await new Promise((resolve) => setTimeout(resolve, input.batchMs));

  // Mensajes sin responder: los posteriores a la última respuesta enviada.
  const recent = await client.from("messages").select("external_id, direction, body, message_type, metadata, sent_at, created_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);
  if (recent.error) throw new Error(`No fue posible leer los mensajes recientes: ${recent.error.message}`);
  const latestInbound = recent.data.find((row) => row.direction === "inbound");
  if (latestInbound && latestInbound.external_id !== message.externalId) return null;
  const pending = [];
  for (const row of recent.data) {
    if (row.direction === "outbound") break;
    if (row.direction === "inbound") pending.unshift(row);
  }

  // Notas de voz del grupo que todavía no tienen transcripción (p. ej. llegaron justo antes y siguen procesándose).
  let currentBody = message.body;
  for (const row of pending) {
    if (row.body === pendingVoiceBody && row.external_id) {
      const transcribed = await storeTranscription(client, provider, runtime.voice, conversationId, row.external_id, row.metadata);
      mediaCostUsd += transcribed.costUsd;
      if (row.external_id === message.externalId && transcribed.body) currentBody = transcribed.body;
    } else if (row.external_id === message.externalId && row.body) {
      currentBody = row.body;
    }
  }

  const attachments: AssistantAttachment[] = [];
  for (const row of pending.slice(-mediaLimits.attachmentsPerTurn)) {
    const media = mediaFromStoredMessage(row.metadata);
    if (!media || media.kind === "audio") continue;
    const attachment = await attachmentFromMedia(provider, media);
    if (attachment) attachments.push(attachment);
  }

  const conversation = await client.from("conversations").select("*").eq("id", conversationId).single();
  if (conversation.error) throw new Error(`No fue posible leer la conversación: ${conversation.error.message}`);
  const replyFormat = runtime.voiceReplies && runtime.voice && message.media?.kind === "audio" ? "voice" : "text";
  return answerWithAssistant({
    client,
    message: { ...message, body: currentBody },
    conversation: conversation.data,
    provider,
    runtime,
    channel,
    attachments,
    replyFormat,
    mediaCostUsd,
  });
}
