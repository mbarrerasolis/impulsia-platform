import { z } from "zod";

/**
 * Origen de marketing de un lead (de dónde llegó la persona al sitio), independiente del canal
 * (`Lead.source`: formulario web, WhatsApp…). Se captura en el navegador al aterrizar y viaja con el formulario.
 */
export const utmParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);

export const leadAttributionSchema = z.object({
  utmSource: text(100).toLowerCase().optional(),
  utmMedium: text(100).toLowerCase().optional(),
  utmCampaign: text(150).optional(),
  utmContent: text(150).optional(),
  utmTerm: text(150).optional(),
  /** Clic de un anuncio de Meta (Facebook/Instagram). */
  fbclid: text(500).optional(),
  /** Dominio externo desde el que llegó, si no hubo UTM. */
  referrer: text(200).optional(),
  landingPath: text(300).optional(),
  capturedAt: z.iso.datetime().optional(),
});

export type LeadAttribution = z.infer<typeof leadAttributionSchema>;

/** Lee un valor recibido del navegador; lo inválido se descarta sin rechazar el lead. */
export function parseLeadAttribution(value: unknown): LeadAttribution | undefined {
  const result = leadAttributionSchema.safeParse(value);
  if (!result.success) return undefined;
  return hasAttribution(result.data) ? result.data : undefined;
}

function hasAttribution(value: LeadAttribution) {
  return Boolean(value.utmSource || value.utmMedium || value.utmCampaign || value.fbclid || value.referrer);
}

/**
 * Atribución de una visita a partir de la URL de aterrizaje y el referrer. Sin UTM, clic de anuncio
 * ni referrer externo es tráfico directo o navegación interna: devuelve `undefined` para no pisar
 * un origen anterior.
 */
export function attributionFromLanding(url: URL, referrer: string | undefined, now: Date): LeadAttribution | undefined {
  const pick = (name: string) => url.searchParams.get(name)?.trim().slice(0, 150) || undefined;
  const referrerHost = externalHost(referrer, url.hostname);
  const candidate: LeadAttribution = {
    utmSource: pick("utm_source")?.toLowerCase(),
    utmMedium: pick("utm_medium")?.toLowerCase(),
    utmCampaign: pick("utm_campaign"),
    utmContent: pick("utm_content"),
    utmTerm: pick("utm_term"),
    fbclid: url.searchParams.get("fbclid")?.trim().slice(0, 500) || undefined,
    referrer: referrerHost,
    landingPath: url.pathname.slice(0, 300),
    capturedAt: now.toISOString(),
  };
  return hasAttribution(candidate) ? parseLeadAttribution(candidate) : undefined;
}

/** Datos que Meta envía en `referral` cuando alguien escribe a WhatsApp desde un anuncio o publicación. */
export interface AdReferral {
  source_url?: string;
  source_id?: string;
  source_type?: string;
  headline?: string;
  ctwa_clid?: string;
}

/**
 * Atribución de una conversación de WhatsApp iniciada desde un anuncio (Click-to-WhatsApp). La red sale de la URL
 * del anuncio (Instagram o Facebook; si no se sabe, "meta"); el medio es `paid` para anuncios y `organic` para
 * publicaciones; la campaña es el título del anuncio y el contenido su id.
 */
export function attributionFromWhatsAppReferral(referral: AdReferral | undefined, receivedAt: string): LeadAttribution | undefined {
  if (!referral || !(referral.source_url || referral.source_id || referral.ctwa_clid)) return undefined;
  const host = externalHost(referral.source_url, "wa.me");
  const source = host?.includes("instagram") ? "instagram" : host?.includes("facebook") || host === "fb.me" ? "facebook" : "meta";
  return parseLeadAttribution({
    utmSource: source,
    utmMedium: referral.source_type === "post" ? "organic" : "paid",
    utmCampaign: referral.headline?.trim().slice(0, 150) || undefined,
    utmContent: referral.source_id?.trim().slice(0, 150) || undefined,
    referrer: host,
    landingPath: "whatsapp",
    capturedAt: receivedAt,
  });
}

const refPart = (value: string | undefined) => (value ?? "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const refPattern = /\[ref:\s*([a-z0-9_-]{1,60})\.([a-z0-9_-]{0,60})\.([a-z0-9_-]{0,60})\.([a-z0-9_-]{0,60})\]/i;

/**
 * Código corto que viaja en el texto prellenado de un enlace a WhatsApp ("[ref: email.outbound.comida-piloto.a-017]"),
 * para que la conversación conserve la procedencia de la visita web (WhatsApp no recibe las UTM del sitio).
 */
export function attributionRefCode(value: LeadAttribution | undefined): string | undefined {
  const source = refPart(value?.utmSource);
  if (!source) return undefined;
  return `[ref: ${[source, refPart(value?.utmMedium), refPart(value?.utmCampaign), refPart(value?.utmContent)].join(".")}]`;
}

/** Lee el código de `attributionRefCode` desde el texto de un mensaje; sin código válido devuelve `undefined`. */
export function attributionFromRefCode(text: string | null | undefined, receivedAt: string): LeadAttribution | undefined {
  const match = text?.match(refPattern);
  if (!match) return undefined;
  const [, utmSource, utmMedium, utmCampaign, utmContent] = match.map((part) => part?.toLowerCase() || undefined);
  return parseLeadAttribution({ utmSource, utmMedium, utmCampaign, utmContent, landingPath: "whatsapp", capturedAt: receivedAt });
}

function externalHost(referrer: string | undefined, ownHost: string) {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host && host !== ownHost.replace(/^www\./, "") ? host.slice(0, 200) : undefined;
  } catch {
    return undefined;
  }
}

const knownSources: Record<string, string> = {
  instagram: "Instagram", ig: "Instagram", "l.instagram.com": "Instagram", "instagram.com": "Instagram",
  facebook: "Facebook", fb: "Facebook", "l.facebook.com": "Facebook", "m.facebook.com": "Facebook", "facebook.com": "Facebook",
  linkedin: "LinkedIn", "linkedin.com": "LinkedIn", "lnkd.in": "LinkedIn",
  google: "Google", "google.com": "Google", "google.cl": "Google",
  whatsapp: "WhatsApp", "wa.me": "WhatsApp", "web.whatsapp.com": "WhatsApp",
};

/** Etiqueta corta para el CRM, p. ej. "Instagram · bio · lanzamiento". */
export function attributionLabel(value: LeadAttribution | undefined): string {
  if (!value) return "Directo o sin datos";
  const raw = value.utmSource ?? value.referrer;
  const source = raw ? knownSources[raw] ?? raw : value.fbclid ? "Anuncio de Meta" : "Desconocido";
  return [source, value.utmMedium, value.utmCampaign].filter(Boolean).join(" · ");
}
