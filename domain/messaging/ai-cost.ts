/** Tarifas públicas por millón de tokens (USD). Fuente: precios de la API de Claude, 2026. */
const modelRates: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
};
/** Modelo desconocido: se asume la tarifa más alta de la tabla para no subestimar el gasto. */
const fallbackRates = { input: 5, output: 25 };
const cacheReadMultiplier = 0.1;
const cacheWriteMultiplier = 1.25;

export interface AiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export const emptyAiTokenUsage = (): AiTokenUsage => ({ inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 });

export function addAiTokenUsage(a: AiTokenUsage, b: AiTokenUsage): AiTokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
  };
}

export function estimateAiCostUsd(model: string, usage: AiTokenUsage) {
  const rates = modelRates[model] ?? fallbackRates;
  const inputCost = (usage.inputTokens + usage.cacheReadInputTokens * cacheReadMultiplier + usage.cacheCreationInputTokens * cacheWriteMultiplier) * rates.input;
  return (inputCost + usage.outputTokens * rates.output) / 1_000_000;
}
