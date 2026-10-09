import type { Lead } from "@/domain/crm/entities";

/**
 * Procedencia de un lead: la red o vía por la que llegó, sea por UTM, referrer o el canal en que
 * se creó (p. ej. un lead que Claudia crea en WhatsApp sin anuncio previo). Es la etiqueta que
 * agrupa el rendimiento y el gasto de marketing.
 */
export const leadChannels = {
  instagram: { label: "Instagram", utmSources: ["instagram", "ig"], referrers: ["instagram.com", "l.instagram.com"] },
  facebook: { label: "Facebook", utmSources: ["facebook", "fb"], referrers: ["facebook.com", "l.facebook.com", "m.facebook.com", "lm.facebook.com"] },
  meta: { label: "Meta (FB/IG)", utmSources: ["meta"], referrers: [] },
  google: { label: "Google", utmSources: ["google", "adwords", "gads"], referrers: ["google.com", "google.cl"] },
  tiktok: { label: "TikTok", utmSources: ["tiktok"], referrers: ["tiktok.com"] },
  linkedin: { label: "LinkedIn", utmSources: ["linkedin"], referrers: ["linkedin.com", "lnkd.in"] },
  whatsapp: { label: "WhatsApp", utmSources: ["whatsapp", "wa"], referrers: ["wa.me", "web.whatsapp.com", "whatsapp.com"] },
  email: { label: "Email", utmSources: ["email", "newsletter", "mailing"], referrers: [] },
  referral: { label: "Referido", utmSources: ["referido", "referral"], referrers: [] },
  web: { label: "Web directa", utmSources: [], referrers: [] },
  other: { label: "Otro", utmSources: [], referrers: [] },
} as const;

export type LeadChannel = keyof typeof leadChannels;
export const leadChannelKeys = Object.keys(leadChannels) as LeadChannel[];

/** Medios de UTM que indican tráfico pagado (anuncios). */
const paidMediums = ["cpc", "ppc", "cpm", "cpa", "paid", "paid_social", "paidsocial", "ads", "ad", "display", "anuncio", "anuncios", "pago"];

export interface LeadOrigin {
  channel: LeadChannel;
  /** true si llegó desde un anuncio (UTM de pago); false si fue orgánico o directo. */
  paid: boolean;
  /** Campaña normalizada (utm_campaign), si existe. */
  campaign?: string;
  /** Etiqueta corta para el CRM, p. ej. "Instagram · Pagado". */
  label: string;
}

const sourceChannel: Partial<Record<Lead["source"], LeadChannel>> = {
  instagram: "instagram",
  whatsapp: "whatsapp",
  email: "email",
  referral: "referral",
  web: "web",
};

function channelFromAttribution(attribution: NonNullable<Lead["attribution"]>): LeadChannel | undefined {
  const utm = attribution.utmSource?.toLowerCase();
  const referrer = attribution.referrer?.toLowerCase();
  for (const key of leadChannelKeys) {
    const channel = leadChannels[key];
    if (utm && (channel.utmSources as readonly string[]).includes(utm)) return key;
    if (referrer && (channel.referrers as readonly string[]).includes(referrer)) return key;
  }
  if (attribution.fbclid) return "meta";
  if (utm || referrer) return "other";
  return undefined;
}

export function isPaidMedium(medium: string | undefined) {
  if (!medium) return false;
  const value = medium.toLowerCase();
  return paidMediums.includes(value) || value.includes("paid") || value.includes("ads");
}

/** Normaliza nombres de campaña para cruzar leads (utm_campaign) con gastos registrados a mano. */
export function normalizeCampaign(value: string | undefined | null) {
  // Sin tildes ni mayúsculas: "Otoño 2026" en el formulario calza con utm_campaign=otono-2026.
  const cleaned = value?.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, "-");
  return cleaned || undefined;
}

export function leadOrigin(lead: Pick<Lead, "source" | "attribution">): LeadOrigin {
  const attribution = lead.attribution;
  const channel = (attribution && channelFromAttribution(attribution)) ?? sourceChannel[lead.source] ?? "other";
  const paid = isPaidMedium(attribution?.utmMedium);
  const campaign = normalizeCampaign(attribution?.utmCampaign);
  const label = [leadChannels[channel].label, paid ? "Pagado" : attribution ? "Orgánico" : undefined].filter(Boolean).join(" · ");
  return { channel, paid, campaign, label };
}
