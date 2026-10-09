import { sanitizeSearch } from "@/domain/crm/lead-filters";

/** Vistas de la bandeja de WhatsApp. */
export const conversationViews = {
  attention: "Requieren atención",
  bot: "Atiende Claudia",
  lead: "Con lead",
  closed: "Cerradas",
} as const;

export type ConversationView = keyof typeof conversationViews;

export interface ConversationFilters {
  view?: ConversationView;
  /** Nombre del perfil o número. */
  search?: string;
}

const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

export function parseConversationFilters(params: Record<string, string | string[] | undefined>): ConversationFilters {
  const view = first(params.view);
  return {
    view: view && view in conversationViews ? view as ConversationView : undefined,
    // El número se guarda sin "+" ni espacios: se buscan sólo los dígitos si el texto es un teléfono.
    search: normalizeConversationSearch(first(params.q)),
  };
}

function normalizeConversationSearch(value: string | undefined) {
  const cleaned = sanitizeSearch(value);
  if (!cleaned) return undefined;
  return /^[\d\s+\-]+$/.test(cleaned) ? cleaned.replace(/\D/g, "") || undefined : cleaned;
}

type Query<Q> = { eq(column: string, value: string | boolean): Q; neq(column: string, value: string): Q; in(column: string, values: string[]): Q; not(column: string, operator: string, value: null): Q; or(filters: string): Q };

/** Aplica la vista y la búsqueda a una consulta de `conversations`. */
export function whereConversationFilters<Q extends Query<Q>>(query: Q, filters: ConversationFilters): Q {
  let result = query;
  if (filters.view === "attention") result = result.eq("human_handoff_requested", true).neq("status", "closed");
  if (filters.view === "bot") result = result.in("status", ["open", "bot_qualifying"]);
  if (filters.view === "lead") result = result.not("lead_id", "is", null);
  if (filters.view === "closed") result = result.eq("status", "closed");
  if (filters.search) result = result.or(`profile_name.ilike.%${filters.search}%,external_participant_id.ilike.%${filters.search}%`);
  return result;
}
