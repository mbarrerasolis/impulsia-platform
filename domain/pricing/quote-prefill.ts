import { z } from "zod";
import type { ComplexityKey } from "./types";

/** Datos con que se abre el cotizador del panel desde una propuesta del asistente de WhatsApp. */
export interface QuotePrefill {
  leadId?: string;
  name: string;
  estimatedDays: number;
  complexity: ComplexityKey;
  thirdPartyMonthlyCost: number;
  notes?: string;
}

/** Tope de las notas en la URL para no superar el largo que aceptan navegadores y clientes de correo. */
export const quotePrefillNotesMaxChars = 1_500;

const complexitySchema = z.enum(["standard", "medium", "high", "research", "advanced_research"]);

const prefillSchema = z.object({
  leadId: z.string().regex(/^[\w-]{1,64}$/).optional(),
  name: z.string().trim().min(3).max(160),
  days: z.coerce.number().positive().max(365),
  complexity: complexitySchema,
  thirdParty: z.coerce.number().nonnegative().max(1_000_000_000).default(0),
  notes: z.string().trim().max(quotePrefillNotesMaxChars).optional(),
});

export function buildQuotePrefillPath(prefill: QuotePrefill) {
  const params = new URLSearchParams({
    name: prefill.name,
    days: String(prefill.estimatedDays),
    complexity: prefill.complexity,
    thirdParty: String(prefill.thirdPartyMonthlyCost),
  });
  if (prefill.leadId) params.set("leadId", prefill.leadId);
  if (prefill.notes) params.set("notes", prefill.notes.slice(0, quotePrefillNotesMaxChars));
  return `/admin/quotes/new?${params.toString()}`;
}

/** Lee el prellenado desde la URL; si falta algo o es inválido, el cotizador parte en blanco. */
export function parseQuotePrefill(searchParams: Record<string, string | string[] | undefined>): QuotePrefill | null {
  const first = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const parsed = prefillSchema.safeParse({
    leadId: first("leadId") || undefined,
    name: first("name"),
    days: first("days"),
    complexity: first("complexity"),
    thirdParty: first("thirdParty") || undefined,
    notes: first("notes") || undefined,
  });
  if (!parsed.success) return null;
  const { leadId, name, days, complexity, thirdParty, notes } = parsed.data;
  return { leadId, name, estimatedDays: days, complexity, thirdPartyMonthlyCost: thirdParty, notes };
}
