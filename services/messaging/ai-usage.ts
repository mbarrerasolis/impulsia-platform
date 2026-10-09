import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiTokenUsage } from "@/domain/messaging/ai-cost";
import type { AssistantActivity } from "@/domain/messaging/assistant-guards";
import type { Database } from "@/lib/supabase/database.types";

type AdminClient = SupabaseClient<Database>;

const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const sinceIso = (ms: number, now: Date) => new Date(now.getTime() - ms).toISOString();

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string) {
  const { count: total, error } = await query;
  if (error) throw new Error(`No fue posible contar ${label}: ${error.message}`);
  return total ?? 0;
}

/** Gasto de la ventana móvil de 24 horas; se usa ventana móvil para no depender de zonas horarias. */
export async function getAiSpendSince(client: AdminClient, since: string) {
  const { data, error } = await client.from("ai_usage_events").select("cost_usd").gte("created_at", since);
  if (error) throw new Error(`No fue posible leer el gasto de IA: ${error.message}`);
  return data.reduce((total, row) => total + Number(row.cost_usd), 0);
}

export async function getAssistantActivity(client: AdminClient, input: { conversationId: string; sender: string; now?: Date }): Promise<AssistantActivity> {
  const now = input.now ?? new Date();
  const inbound = () => client.from("messages").select("id", { count: "exact", head: true }).eq("direction", "inbound").eq("sender_ref", input.sender);
  const [spentLast24hUsd, conversationRepliesLast24h, senderMessagesLastMinute, senderMessagesLast24h] = await Promise.all([
    getAiSpendSince(client, sinceIso(dayMs, now)),
    count(client.from("ai_usage_events").select("id", { count: "exact", head: true }).eq("conversation_id", input.conversationId).gte("created_at", sinceIso(dayMs, now)), "las respuestas de la conversación"),
    count(inbound().gte("sent_at", sinceIso(minuteMs, now)), "los mensajes del último minuto"),
    count(inbound().gte("sent_at", sinceIso(dayMs, now)), "los mensajes del día"),
  ]);
  return { spentLast24hUsd, conversationRepliesLast24h, senderMessagesLastMinute, senderMessagesLast24h };
}

export async function recordAiUsage(client: AdminClient, input: {
  conversationId: string | null;
  purpose: "whatsapp" | "preview" | "web" | "instagram";
  model: string;
  usage: AiTokenUsage;
  modelCalls: number;
  costUsd: number;
}) {
  const { error } = await client.from("ai_usage_events").insert({
    conversation_id: input.conversationId,
    purpose: input.purpose,
    model: input.model,
    input_tokens: input.usage.inputTokens,
    output_tokens: input.usage.outputTokens,
    cache_read_input_tokens: input.usage.cacheReadInputTokens,
    cache_creation_input_tokens: input.usage.cacheCreationInputTokens,
    model_calls: input.modelCalls,
    cost_usd: Number(input.costUsd.toFixed(6)),
  });
  // Un fallo al registrar no debe dejar al cliente sin respuesta, pero sí quedar en los logs.
  if (error) console.error("ai.usage.record_failed", { message: error.message });
}

export async function getAiSpendSummary(client: AdminClient, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [last24hUsd, monthToDateUsd, repliesLast24h] = await Promise.all([
    getAiSpendSince(client, sinceIso(dayMs, now)),
    getAiSpendSince(client, monthStart),
    count(client.from("ai_usage_events").select("id", { count: "exact", head: true }).gte("created_at", sinceIso(dayMs, now)), "las respuestas del día"),
  ]);
  return { last24hUsd, monthToDateUsd, repliesLast24h };
}
