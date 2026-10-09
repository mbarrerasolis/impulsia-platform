import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Conversions API de Meta: repite en el servidor los eventos del píxel para que no se pierdan con
 * bloqueadores o iOS. Mismo `event_id` que el píxel del navegador → Meta los deduplica.
 * Sólo se usa cuando la persona aceptó las cookies de publicidad en el sitio.
 */

/** Señales que el formulario manda sólo si hubo consentimiento de marketing. */
export const marketingSignalsSchema = z.object({
  consent: z.literal(true),
  /** Cookie `_fbp` del píxel (identifica el navegador). */
  fbp: z.string().trim().max(200).optional(),
  /** Cookie `_fbc` o derivada del `fbclid` (identifica el clic del anuncio). */
  fbc: z.string().trim().max(600).optional(),
  pageUrl: z.url().max(1_000).optional(),
});

export type MarketingSignals = z.infer<typeof marketingSignalsSchema>;

export function parseMarketingSignals(value: unknown): MarketingSignals | undefined {
  const result = marketingSignalsSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Teléfono en formato E.164 sin "+", como lo pide Meta; asume Chile si viene sin código de país. */
export function normalizePhoneForMeta(phone: string | undefined): string | undefined {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length === 9 && digits.startsWith("9")) return `56${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : undefined;
}

export interface MetaLeadEventInput {
  eventId: string;
  eventName: "Lead" | "Contact" | "Schedule";
  email?: string;
  phone?: string;
  firstName?: string;
  signals: MarketingSignals;
  clientIp?: string;
  userAgent?: string;
  now?: Date;
}

/** Evento de sitio web con datos personales hasheados (SHA-256, normalizados), nunca en claro. */
export function buildMetaWebsiteEvent(input: MetaLeadEventInput) {
  const phone = normalizePhoneForMeta(input.phone);
  const firstName = input.firstName?.trim().split(/\s+/)[0]?.toLowerCase();
  const userData: Record<string, unknown> = {
    ...(input.email ? { em: [sha256(input.email.trim().toLowerCase())] } : {}),
    ...(phone ? { ph: [sha256(phone)] } : {}),
    ...(firstName ? { fn: [sha256(firstName)] } : {}),
    ...(input.clientIp ? { client_ip_address: input.clientIp } : {}),
    ...(input.userAgent ? { client_user_agent: input.userAgent.slice(0, 500) } : {}),
    ...(input.signals.fbp ? { fbp: input.signals.fbp } : {}),
    ...(input.signals.fbc ? { fbc: input.signals.fbc } : {}),
  };
  return {
    event_name: input.eventName,
    event_time: Math.floor((input.now ?? new Date()).getTime() / 1000),
    event_id: input.eventId,
    action_source: "website",
    ...(input.signals.pageUrl ? { event_source_url: input.signals.pageUrl } : {}),
    user_data: userData,
  };
}

export async function sendMetaEvents(
  config: { pixelId: string; accessToken: string; graphVersion: string; testEventCode?: string },
  events: ReturnType<typeof buildMetaWebsiteEvent>[],
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const response = await fetchImpl(`https://graph.facebook.com/${config.graphVersion}/${config.pixelId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.accessToken}` },
    body: JSON.stringify({ data: events, ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}) }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Meta Conversions API respondió ${response.status}: ${detail.slice(0, 300)}`);
  }
}
