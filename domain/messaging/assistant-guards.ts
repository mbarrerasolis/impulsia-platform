export interface AssistantLimits {
  dailyBudgetUsd: number;
  maxRepliesPerConversationDay: number;
  maxMessagesPerSenderMinute: number;
  maxMessagesPerSenderDay: number;
}

export interface AssistantActivity {
  spentLast24hUsd: number;
  conversationRepliesLast24h: number;
  senderMessagesLastMinute: number;
  senderMessagesLast24h: number;
}

export type AssistantGuardDecision =
  | { allowed: true }
  /** `reply: null` significa no responder (ráfagas o abuso): el mensaje queda guardado para revisión humana. */
  | { allowed: false; reason: "sender_rate_minute" | "sender_rate_day" | "conversation_cap" | "daily_budget"; reply: string | null; handoff: boolean };

export const assistantFallbackReply = "Gracias por escribirnos. Una persona de nuestro equipo continuará esta conversación a la brevedad.";

/** Se evalúa antes de cada llamada al modelo; el orden va de lo más barato de cortar a lo más grave. */
export function evaluateAssistantGuards(activity: AssistantActivity, limits: AssistantLimits): AssistantGuardDecision {
  if (activity.senderMessagesLastMinute > limits.maxMessagesPerSenderMinute) {
    return { allowed: false, reason: "sender_rate_minute", reply: null, handoff: false };
  }
  if (activity.senderMessagesLast24h > limits.maxMessagesPerSenderDay) {
    return { allowed: false, reason: "sender_rate_day", reply: null, handoff: true };
  }
  if (activity.conversationRepliesLast24h >= limits.maxRepliesPerConversationDay) {
    return { allowed: false, reason: "conversation_cap", reply: assistantFallbackReply, handoff: true };
  }
  if (activity.spentLast24hUsd >= limits.dailyBudgetUsd) {
    return { allowed: false, reason: "daily_budget", reply: assistantFallbackReply, handoff: true };
  }
  return { allowed: true };
}

/** true cuando el gasto cruza el 80% del presupuesto con esta respuesta (para avisar una sola vez). */
export function crossedBudgetWarning(spentBeforeUsd: number, spentAfterUsd: number, dailyBudgetUsd: number) {
  const threshold = dailyBudgetUsd * 0.8;
  return spentBeforeUsd < threshold && spentAfterUsd >= threshold;
}
