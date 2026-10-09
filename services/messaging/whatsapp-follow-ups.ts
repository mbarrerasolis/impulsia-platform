import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateFollowUp, type FollowUpRules, type FollowUpSkipReason } from "@/domain/messaging/follow-up";
import type { ConversationSender } from "./process-whatsapp-webhook";
import type { Database } from "@/lib/supabase/database.types";
import { getAiSpendSince, recordAiUsage } from "./ai-usage";
import { readAssistantState, withAssistantState } from "./process-whatsapp-webhook";
import type { AssistantHistoryMessage, ConversationAssistant } from "./sales-assistant";

type AdminClient = SupabaseClient<Database>;

export type FollowUpOutcome = "sent" | "skipped_by_model" | FollowUpSkipReason | "budget";

/**
 * Revisa una conversación después del plazo y, si el cliente no contestó, le escribe un seguimiento.
 * El webhook lo programa tras cada respuesta del asistente; las reglas descartan los casos que ya no aplican.
 */
export async function followUpConversation(input: {
  client: AdminClient;
  provider: Pick<ConversationSender, "sendText">;
  assistant: ConversationAssistant;
  model: string;
  dailyBudgetUsd: number;
  rules: FollowUpRules;
  conversationId: string;
  /** Canal de la conversación para registrar el gasto; WhatsApp por defecto. */
  channel?: "whatsapp" | "instagram";
  now?: Date;
}): Promise<FollowUpOutcome> {
  const { client, rules } = input;
  const now = input.now ?? new Date();

  const found = await client.from("conversations")
    .select("id, status, bot_context, lead_id, profile_name, external_participant_id, last_message_at")
    .eq("id", input.conversationId)
    .single();
  if (found.error) throw new Error(`No fue posible leer la conversación: ${found.error.message}`);
  const conversation = found.data;

  // `last_message_at` guarda el último mensaje del cliente.
  const recent = await client.from("messages").select("direction, body, sent_at, sender_ref")
    .eq("conversation_id", conversation.id)
    .order("sent_at", { ascending: false })
    .limit(21);
  if (recent.error) throw new Error(`No fue posible leer los mensajes: ${recent.error.message}`);
  const last = recent.data[0];
  const state = readAssistantState(conversation.bot_context);
  const decision = evaluateFollowUp({
    status: conversation.status,
    lastInboundAt: conversation.last_message_at,
    lastMessage: last ? { direction: last.direction, sentAt: last.sent_at } : null,
    meetings: state.meetings,
    followUps: state.followUps,
  }, rules, now);
  if (!decision.due) return decision.reason;
  if (!conversation.external_participant_id) return "no_inbound";

  const spent = await getAiSpendSince(client, new Date(now.getTime() - 24 * 3_600_000).toISOString());
  if (spent >= input.dailyBudgetUsd) return "budget";

  // Se marca antes de escribir: si algo falla no se reintenta, y el cliente nunca recibe dos seguimientos por la misma pausa.
  const markFollowUp = (count: number) => client.from("conversations").update({
    bot_context: withAssistantState(conversation.bot_context, { ...state, followUps: { count, lastForInboundAt: conversation.last_message_at ?? undefined } }),
  }).eq("id", conversation.id);
  const marked = await markFollowUp(state.followUps.count);
  if (marked.error) throw new Error(`No fue posible marcar el seguimiento: ${marked.error.message}`);

  const history: AssistantHistoryMessage[] = recent.data
    .filter((row) => row.body && (row.direction === "inbound" || row.direction === "outbound"))
    .reverse()
    .map((row) => ({ direction: row.direction as AssistantHistoryMessage["direction"], body: row.body ?? "" }));
  const written = await input.assistant.writeFollowUp({
    history,
    minutesSilent: Math.max(1, Math.round((now.getTime() - new Date(last.sent_at).getTime()) / 60_000)),
    profileName: conversation.profile_name ?? undefined,
    leadRegistered: Boolean(conversation.lead_id),
  });
  await recordAiUsage(client, { conversationId: conversation.id, purpose: input.channel ?? "whatsapp", model: input.model, usage: written.usage, modelCalls: 1, costUsd: written.costUsd });
  if (!written.reply) return "skipped_by_model";

  const externalId = await input.provider.sendText(conversation.external_participant_id, written.reply);
  const stored = await client.from("messages").insert({
    conversation_id: conversation.id,
    external_id: externalId,
    direction: "outbound",
    sender_ref: last.sender_ref,
    body: written.reply,
    message_type: "text",
    sent_at: new Date().toISOString(),
    delivery_status: "sent",
    metadata: { followUp: true },
  });
  if (stored.error) throw new Error(`No fue posible guardar el seguimiento: ${stored.error.message}`);
  const counted = await markFollowUp(state.followUps.count + 1);
  if (counted.error) throw new Error(`No fue posible contar el seguimiento: ${counted.error.message}`);
  return "sent";
}
