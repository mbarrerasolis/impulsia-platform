/** Campos anti-bot que el formulario agrega al payload y que no forman parte del lead. */
export const leadSpamFields = { honeypot: "website", elapsedMs: "elapsedMs", captchaToken: "captchaToken" } as const;

/** Nadie completa el formulario real en menos de esto; los bots lo envían al instante. */
export const minimumFillTimeMs = 3_000;

export type LeadSubmissionSignals = { honeypot: string; elapsedMs?: number; captchaToken?: string };

/** Separa las señales anti-bot del resto del payload, que sigue validándose con `createLeadSchema`. */
export function splitLeadSubmission(body: unknown): { signals: LeadSubmissionSignals; input: unknown } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { signals: { honeypot: "" }, input: body };
  const { [leadSpamFields.honeypot]: honeypot, [leadSpamFields.elapsedMs]: elapsedMs, [leadSpamFields.captchaToken]: captchaToken, ...input } = body as Record<string, unknown>;
  return {
    signals: {
      honeypot: typeof honeypot === "string" ? honeypot.trim() : "",
      elapsedMs: typeof elapsedMs === "number" && Number.isFinite(elapsedMs) ? elapsedMs : undefined,
      captchaToken: typeof captchaToken === "string" && captchaToken ? captchaToken : undefined
    },
    input
  };
}

/**
 * Señales baratas de envío automatizado: el campo trampa (invisible para personas) viene lleno,
 * o el formulario se envió más rápido de lo humanamente posible. Si falta el tiempo (p. ej. una
 * pestaña abierta antes del despliegue) no se descarta: para eso están Turnstile y los topes.
 */
export function detectBotSubmission(signals: LeadSubmissionSignals): "honeypot" | "too_fast" | undefined {
  if (signals.honeypot) return "honeypot";
  if (signals.elapsedMs !== undefined && signals.elapsedMs < minimumFillTimeMs) return "too_fast";
  return undefined;
}
