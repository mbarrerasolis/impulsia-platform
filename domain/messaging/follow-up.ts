/**
 * Seguimiento automático de conversaciones pausadas: si el asistente respondió y el cliente dejó de
 * contestar unos minutos, se le escribe una vez para retomar (agendar la reunión o aclarar dudas).
 */
export interface FollowUpRules {
  /** Minutos sin respuesta del cliente desde el último mensaje del asistente. */
  delayMinutes: number;
  /** WhatsApp sólo permite texto libre dentro de las 24 h del último mensaje del cliente; se deja margen. */
  windowHours: number;
  maxPerConversation: number;
}

export const defaultFollowUpRules: Omit<FollowUpRules, "delayMinutes"> = {
  windowHours: 23,
  maxPerConversation: 2,
};

export interface FollowUpState {
  count: number;
  /** `sent_at` del mensaje del cliente al que ya se le hizo seguimiento (uno por pausa). */
  lastForInboundAt?: string;
}

export interface FollowUpCandidate {
  status: string;
  lastInboundAt: string | null;
  lastMessage: { direction: string; sentAt: string } | null;
  meetings: number;
  followUps: FollowUpState;
}

export type FollowUpSkipReason =
  | "status"
  | "no_inbound"
  | "awaiting_reply"
  | "meeting_booked"
  | "already_followed_up"
  | "max_reached"
  | "too_soon"
  | "window_closed";

export type FollowUpDecision = { due: true } | { due: false; reason: FollowUpSkipReason };

/** Sólo conversaciones que atiende la IA; si una persona la tomó o se cerró, no se interviene. */
const eligibleStatuses = new Set(["bot_qualifying", "qualified"]);

export function evaluateFollowUp(candidate: FollowUpCandidate, rules: FollowUpRules, now: Date): FollowUpDecision {
  if (!eligibleStatuses.has(candidate.status)) return { due: false, reason: "status" };
  if (!candidate.lastInboundAt || !candidate.lastMessage) return { due: false, reason: "no_inbound" };
  // Si lo último es del cliente, le toca responder al asistente, no hacer seguimiento.
  if (candidate.lastMessage.direction !== "outbound") return { due: false, reason: "awaiting_reply" };
  if (candidate.meetings > 0) return { due: false, reason: "meeting_booked" };
  if (candidate.followUps.lastForInboundAt === candidate.lastInboundAt) return { due: false, reason: "already_followed_up" };
  if (candidate.followUps.count >= rules.maxPerConversation) return { due: false, reason: "max_reached" };
  // Un segundo de tolerancia: la espera se programa justo al plazo.
  if (now.getTime() - new Date(candidate.lastMessage.sentAt).getTime() < rules.delayMinutes * 60_000 - 1_000) return { due: false, reason: "too_soon" };
  if (now.getTime() - new Date(candidate.lastInboundAt).getTime() > rules.windowHours * 3_600_000) return { due: false, reason: "window_closed" };
  return { due: true };
}
