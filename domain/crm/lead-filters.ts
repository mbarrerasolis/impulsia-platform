import { leadSources, type Lead, type LeadSource } from "@/domain/crm/entities";

/** Filtros del CRM; todos opcionales y combinables con la temperatura y el orden. */
export interface LeadFilters {
  /** Texto libre sobre nombre, empresa, email o teléfono. */
  search?: string;
  source?: LeadSource;
  status?: Lead["status"];
  origin?: LeadOriginKey;
}

export const leadStatuses = ["new", "contacted", "qualified", "converted", "lost"] as const satisfies readonly Lead["status"][];

/** Origen de marketing agrupado: los valores de UTM y los dominios de referencia que cuentan como cada red. */
export const leadOrigins = {
  instagram: { label: "Instagram", utmSources: ["instagram", "ig"], referrers: ["instagram.com", "l.instagram.com"] },
  facebook: { label: "Facebook", utmSources: ["facebook", "fb"], referrers: ["facebook.com", "l.facebook.com", "m.facebook.com"] },
  google: { label: "Google", utmSources: ["google"], referrers: ["google.com", "google.cl"] },
  linkedin: { label: "LinkedIn", utmSources: ["linkedin"], referrers: ["linkedin.com", "lnkd.in"] },
  none: { label: "Sin origen registrado", utmSources: [], referrers: [] },
} as const;

export type LeadOriginKey = keyof typeof leadOrigins;

const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

/**
 * Deja sólo caracteres seguros para el filtro `or` de PostgREST (las comas, paréntesis y comodines
 * cambiarían la consulta) y recorta el largo.
 */
export function sanitizeSearch(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/[^\p{L}\p{N}@.+\-_ ]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return cleaned || undefined;
}

export function parseLeadFilters(params: Record<string, string | string[] | undefined>): LeadFilters {
  const source = first(params.source);
  const status = first(params.status);
  const origin = first(params.origin);
  return {
    search: sanitizeSearch(first(params.q)),
    source: leadSources.find((value) => value === source),
    status: leadStatuses.find((value) => value === status),
    origin: origin && origin in leadOrigins ? origin as LeadOriginKey : undefined,
  };
}

export function hasLeadFilters(filters: LeadFilters) {
  return Boolean(filters.search || filters.source || filters.status || filters.origin);
}

/** Misma regla que la consulta a Supabase, para el modo demo y los tests. */
export function matchesLeadFilters(lead: Pick<Lead, "name" | "company" | "email" | "phone" | "source" | "status" | "attribution">, filters: LeadFilters) {
  if (filters.source && lead.source !== filters.source) return false;
  if (filters.status && lead.status !== filters.status) return false;
  if (filters.origin) {
    if (filters.origin === "none") { if (lead.attribution) return false; }
    else {
      const origin = leadOrigins[filters.origin];
      const utm = lead.attribution?.utmSource;
      const referrer = lead.attribution?.referrer;
      if (!(utm && (origin.utmSources as readonly string[]).includes(utm)) && !(referrer && (origin.referrers as readonly string[]).includes(referrer))) return false;
    }
  }
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    if (![lead.name, lead.company, lead.email, lead.phone ?? ""].some((value) => value.toLowerCase().includes(needle))) return false;
  }
  return true;
}
