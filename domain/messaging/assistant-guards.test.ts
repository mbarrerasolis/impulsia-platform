import { describe, expect, it } from "vitest";
import { estimateAiCostUsd } from "./ai-cost";
import { crossedBudgetWarning, evaluateAssistantGuards } from "./assistant-guards";

const limits = { dailyBudgetUsd: 2, maxRepliesPerConversationDay: 30, maxMessagesPerSenderMinute: 10, maxMessagesPerSenderDay: 50 };
const calm = { spentLast24hUsd: 0.5, conversationRepliesLast24h: 3, senderMessagesLastMinute: 1, senderMessagesLast24h: 4 };

describe("evaluateAssistantGuards", () => {
  it("permite responder dentro de los límites", () => {
    expect(evaluateAssistantGuards(calm, limits)).toEqual({ allowed: true });
  });

  it("ignora ráfagas sin responder ni derivar", () => {
    expect(evaluateAssistantGuards({ ...calm, senderMessagesLastMinute: 11 }, limits)).toMatchObject({ allowed: false, reason: "sender_rate_minute", reply: null, handoff: false });
  });

  it("deriva en silencio a quien supera el máximo diario", () => {
    expect(evaluateAssistantGuards({ ...calm, senderMessagesLast24h: 51 }, limits)).toMatchObject({ allowed: false, reason: "sender_rate_day", reply: null, handoff: true });
  });

  it("deriva con respuesta fija al llegar al tope de la conversación o del presupuesto", () => {
    expect(evaluateAssistantGuards({ ...calm, conversationRepliesLast24h: 30 }, limits)).toMatchObject({ reason: "conversation_cap", handoff: true });
    const budget = evaluateAssistantGuards({ ...calm, spentLast24hUsd: 2 }, limits);
    expect(budget).toMatchObject({ reason: "daily_budget", handoff: true });
    expect(budget.allowed === false && budget.reply).toBeTruthy();
  });
});

describe("crossedBudgetWarning", () => {
  it("avisa sólo al cruzar el 80%", () => {
    expect(crossedBudgetWarning(1.5, 1.61, 2)).toBe(true);
    expect(crossedBudgetWarning(1.61, 1.7, 2)).toBe(false);
    expect(crossedBudgetWarning(1, 1.2, 2)).toBe(false);
  });
});

describe("estimateAiCostUsd", () => {
  it("aplica tarifas de entrada, salida y caché", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 100_000, cacheReadInputTokens: 1_000_000, cacheCreationInputTokens: 0 };
    expect(estimateAiCostUsd("claude-sonnet-5", usage)).toBeCloseTo(2 + 1 + 0.2);
  });

  it("usa la tarifa más alta para un modelo desconocido", () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
    expect(estimateAiCostUsd("modelo-nuevo", usage)).toBe(5);
  });
});
