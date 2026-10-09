const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Valida en el servidor un token de Cloudflare Turnstile. Cada token sirve una sola vez y dura
 * 5 minutos. Ante un fallo de red devuelve `false`: sin verificación no se acepta el envío.
 */
export async function verifyTurnstileToken(
  input: { secret: string; token: string; remoteIp?: string },
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  const body = new URLSearchParams({ secret: input.secret, response: input.token });
  if (input.remoteIp) body.set("remoteip", input.remoteIp);
  try {
    const response = await fetchImpl(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; "error-codes"?: string[] };
    if (!result.success) console.warn("turnstile.rejected", { codes: result["error-codes"] ?? [] });
    return result.success === true;
  } catch (error) {
    console.error("turnstile.unavailable", { message: error instanceof Error ? error.message : "unknown" });
    return false;
  }
}
