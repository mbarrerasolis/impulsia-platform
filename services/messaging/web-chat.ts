import "server-only";
import { z } from "zod";
import { assistantInterestScores } from "@/domain/crm/lead-temperature";
import { crossedBudgetWarning, evaluateAssistantGuards } from "@/domain/messaging/assistant-guards";
import type { LeadAttribution } from "@/domain/marketing/attribution";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { getAssistantActivity, recordAiUsage } from "./ai-usage";
import type { AssistantHistoryMessage } from "./sales-assistant";
import type { WhatsAppAssistantRuntime, WhatsAppInboundOutcome } from "./process-whatsapp-webhook";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Chat del sitio con el asistente. Cada visitante tiene un identificador aleatorio guardado en su
 * navegador (es su "llave": sólo con él se lee la conversación). Las conversaciones quedan en la
 * misma bandeja que WhatsApp, en un canal de tipo `web`; si una persona la toma, la IA deja de
 * responder y el visitante ve las respuestas del equipo al consultar el historial.
 */
export const webChatMessageSchema = z.object({
  visitorId: z.uuid(),
  message: z.string().trim().min(1).max(1_500),
  /** Página donde está el visitante (contexto para el equipo). */
  page: z.string().trim().max(300).optional(),
});

export const webChatPollSchema = z.object({ visitorId: z.uuid(), after: z.iso.datetime({ offset: true }).optional() });

const senderRef = (visitorId: string) => `web:${visitorId}`;

async function getOrCreateWebChannel(client: AdminClient) {
  const found = await client.from("channels").select("id").eq("type", "web").eq("provider", "site").eq("external_identifier", "site-chat").maybeSingle();
  if (found.error) throw new Error(`No fue posible leer el canal web: ${found.error.message}`);
  if (found.data) return found.data.id;
  const created = await client.from("channels").insert({ type: "web", provider: "site", status: "active", external_identifier: "site-chat" }).select("id").single();
  if (created.error) {
    // Dos mensajes simultáneos pueden crear el canal a la vez: se reintenta la lectura.
    const retry = await client.from("channels").select("id").eq("provider", "site").eq("external_identifier", "site-chat").single();
    if (retry.error) throw new Error(`No fue posible crear el canal web: ${created.error.message}`);
    return retry.data.id;
  }
  return created.data.id;
}

async function findConversation(client: AdminClient, channelId: string, visitorId: string) {
  const found = await client.from("conversations").select("*").eq("channel_id", channelId).eq("external_participant_id", visitorId).maybeSingle();
  if (found.error) throw new Error(`No fue posible leer la conversación: ${found.error.message}`);
  return found.data;
}

export interface WebChatMessage { id: string; direction: "inbound" | "outbound"; body: string; sentAt: string; fromTeam: boolean }

/** Mensajes de la conversación del visitante (sólo cuerpo, sentido y fecha). */
export async function loadWebChat(client: AdminClient, visitorId: string, after?: string): Promise<{ messages: WebChatMessage[]; waitingHuman: boolean }> {
  const channelId = await getOrCreateWebChannel(client);
  const conversation = await findConversation(client, channelId, visitorId);
  if (!conversation) return { messages: [], waitingHuman: false };
  let query = client.from("messages").select("id, direction, body, sent_at, metadata").eq("conversation_id", conversation.id).order("sent_at", { ascending: true }).limit(100);
  if (after) query = query.gt("sent_at", after);
  const { data, error } = await query;
  if (error) throw new Error(`No fue posible leer los mensajes: ${error.message}`);
  return {
    waitingHuman: conversation.status === "waiting_human",
    messages: data.filter((row) => row.body && (row.direction === "inbound" || row.direction === "outbound")).map((row) => ({
      id: row.id,
      direction: row.direction as "inbound" | "outbound",
      body: row.body ?? "",
      sentAt: row.sent_at,
      fromTeam: (row.metadata as { source?: string } | null)?.source === "admin",
    })),
  };
}

/** Procesa un mensaje del visitante y devuelve la respuesta del asistente (o null si atiende una persona). */
export async function processWebChatMessage(input: {
  client: AdminClient;
  runtime: WhatsAppAssistantRuntime;
  visitorId: string;
  message: string;
  page?: string;
  attribution?: LeadAttribution;
}): Promise<{ reply: string | null; outcome: WhatsAppInboundOutcome & { channel: "web" } }> {
  const { client, runtime, visitorId } = input;
  const channelId = await getOrCreateWebChannel(client);
  let conversation = await findConversation(client, channelId, visitorId);
  if (!conversation) {
    const created = await client.from("conversations").insert({
      channel_id: channelId,
      external_participant_id: visitorId,
      status: "bot_qualifying",
      qualification_state: "ai_conversation",
      profile_name: "Visitante del sitio",
      bot_context: (input.page ? { landingPage: input.page } : {}) as Json,
    }).select("*").single();
    if (created.error) throw new Error(`No fue posible crear la conversación web: ${created.error.message}`);
    conversation = created.data;
  }
  const now = new Date().toISOString();
  const stored = await client.from("messages").insert({
    conversation_id: conversation.id, direction: "inbound", sender_ref: senderRef(visitorId), body: input.message, message_type: "text", sent_at: now, metadata: (input.page ? { page: input.page } : {}) as Json,
  }).select("id").single();
  if (stored.error) throw new Error(`No fue posible guardar el mensaje: ${stored.error.message}`);
  const base = { duplicate: false, conversationId: conversation.id, leadId: conversation.lead_id, channel: "web" as const };

  // Una persona ya tomó la conversación (o se cerró): la IA no interviene.
  if (conversation.status === "waiting_human" || conversation.status === "closed") {
    await client.from("conversations").update({ last_message_at: now }).eq("id", conversation.id);
    return { reply: null, outcome: base };
  }

  const activity = await getAssistantActivity(client, { conversationId: conversation.id, sender: senderRef(visitorId) });
  const guard = evaluateAssistantGuards(activity, runtime.limits);
  if (!guard.allowed) {
    await client.from("conversations").update({ last_message_at: now, ...(guard.handoff ? { status: "waiting_human", qualification_state: "waiting_human", human_handoff_requested: true } : {}) }).eq("id", conversation.id);
    if (guard.reply) await storeReply(client, conversation.id, guard.reply);
    return { reply: guard.reply ?? null, outcome: { ...base, handoff: guard.handoff ? { reason: "Se alcanzó un límite del asistente en el chat del sitio.", priority: "normal" } : null } };
  }

  const history = await client.from("messages").select("direction, body, id").eq("conversation_id", conversation.id).order("sent_at", { ascending: false }).limit(21);
  if (history.error) throw new Error(`No fue posible leer el historial: ${history.error.message}`);
  const turns: AssistantHistoryMessage[] = history.data.filter((row) => row.id !== stored.data.id && row.body && (row.direction === "inbound" || row.direction === "outbound")).reverse().map((row) => ({ direction: row.direction as "inbound" | "outbound", body: row.body ?? "" }));

  let lead: WhatsAppInboundOutcome["lead"];
  const result = await runtime.assistant.runTurn({ channel: "web", history: turns, message: input.message, existingLeadId: conversation.lead_id, conversationId: conversation.id }, {
    registerLead: async (data) => {
      const inserted = await client.from("leads").insert({
        source: "web",
        attribution: input.attribution ? (input.attribution as unknown as Json) : null,
        name: data.name, company: data.company, email: data.email, phone: data.phone ?? null,
        raw_need_description: data.need, systems: data.systems, api_knowledge: "unknown", primary_goal: data.goal,
        consent_given: true, status: "new", score: assistantInterestScores[data.interest],
      }).select("id").single();
      if (inserted.error) throw new Error(`No fue posible crear el lead del chat: ${inserted.error.message}`);
      lead = { ...data, phone: data.phone ?? "" };
      return { leadId: inserted.data.id };
    },
    requestHandoff: async () => {},
    proposeQuote: async () => {},
  });
  await recordAiUsage(client, { conversationId: conversation.id, purpose: "web", model: runtime.model, usage: result.usage, modelCalls: result.modelCalls, costUsd: result.costUsd });

  const updated = await client.from("conversations").update({
    last_message_at: new Date().toISOString(),
    status: result.handoff ? "waiting_human" : result.leadId ? "qualified" : "bot_qualifying",
    qualification_state: result.handoff ? "waiting_human" : result.leadId ? "qualified" : "ai_conversation",
    human_handoff_requested: Boolean(result.handoff || result.leadId),
    lead_id: result.leadId,
    ...(lead ? { profile_name: lead.name } : {}),
  }).eq("id", conversation.id);
  if (updated.error) throw new Error(`No fue posible actualizar la conversación: ${updated.error.message}`);
  await storeReply(client, conversation.id, result.reply);

  const spentAfter = activity.spentLast24hUsd + result.costUsd;
  return {
    reply: result.reply,
    outcome: {
      ...base, leadId: result.leadId, lead, handoff: result.handoff,
      ...(crossedBudgetWarning(activity.spentLast24hUsd, spentAfter, runtime.limits.dailyBudgetUsd) ? { budgetWarning: { spentUsd: spentAfter, budgetUsd: runtime.limits.dailyBudgetUsd } } : {}),
    },
  };
}

async function storeReply(client: AdminClient, conversationId: string, body: string) {
  const { error } = await client.from("messages").insert({ conversation_id: conversationId, direction: "outbound", sender_ref: "site-chat", body, message_type: "text", sent_at: new Date().toISOString(), delivery_status: "sent", metadata: { source: "assistant" } });
  if (error) console.error("web_chat.reply.store_failed", { message: error.message });
}
