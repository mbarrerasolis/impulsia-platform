import { createHash } from "node:crypto";
import { computeAvailableSlots, isSlotFree, isSlotWithinRules, type BusyInterval, type SchedulingRules } from "@/domain/scheduling/slots";
import type { CreatedCalendarEvent } from "@/integrations/calendar/google-calendar";

/** Lo que el agendador necesita del calendario; permite probarlo sin Google. */
export interface CalendarPort {
  busy(timeMin: Date, timeMax: Date): Promise<BusyInterval[]>;
  createEvent(input: { eventId: string; start: Date; end: Date; summary: string; description: string; attendeeEmail: string; requestId: string }): Promise<CreatedCalendarEvent>;
}

export interface MeetingRequest {
  start: Date;
  attendeeEmail: string;
  attendeeName: string;
  company: string;
  topic: string;
  conversationUrl?: string;
  /** Por dónde se agendó, para la descripción del evento; por defecto, el asistente de WhatsApp. */
  origin?: string;
  /** Clave estable por conversación para que un reintento no cree dos reuniones. */
  idempotencyKey: string;
}

export type BookingResult =
  | { ok: true; event: CreatedCalendarEvent; start: Date; end: Date }
  | { ok: false; reason: "outside_rules" | "busy" };

export const maxOfferedSlots = 4;

/** Id de evento válido para Google (caracteres 0-9 y a-v), estable para la misma clave. */
export function calendarEventId(idempotencyKey: string) {
  return `impulsia${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32)}`.replace(/[^0-9a-v]/g, "0");
}

/** Agenda reuniones del asistente según las reglas de horario y la disponibilidad real del calendario. */
export class MeetingScheduler {
  constructor(private readonly calendar: CalendarPort, readonly rules: SchedulingRules, readonly brandName: string, private readonly now: () => Date = () => new Date()) {}

  async listSlots(maxSlots = maxOfferedSlots, options: { allPerDay?: boolean } = {}) {
    const now = this.now();
    const busy = await this.calendar.busy(now, new Date(now.getTime() + (this.rules.horizonDays + 1) * 24 * 60 * 60_000));
    return computeAvailableSlots({ now, busy, rules: this.rules, maxSlots, allPerDay: options.allPerDay });
  }

  async book(request: MeetingRequest): Promise<BookingResult> {
    const now = this.now();
    if (!isSlotWithinRules(request.start, this.rules, now)) return { ok: false, reason: "outside_rules" };
    const end = new Date(request.start.getTime() + this.rules.meetingMinutes * 60_000);
    // Se vuelve a consultar justo antes de crear: el horario pudo ocuparse desde que se ofreció.
    const busy = await this.calendar.busy(request.start, end);
    if (!isSlotFree(request.start, this.rules, busy)) return { ok: false, reason: "busy" };
    const event = await this.calendar.createEvent({
      eventId: calendarEventId(request.idempotencyKey),
      start: request.start,
      end,
      summary: `${this.brandName} · ${request.company}: ${request.topic}`.slice(0, 200),
      description: [
        `Reunión agendada ${request.origin ?? "por el asistente de WhatsApp"} con ${request.attendeeName} (${request.company}).`,
        "",
        `Tema: ${request.topic}`,
        ...(request.conversationUrl ? ["", `Conversación: ${request.conversationUrl}`] : []),
      ].join("\n"),
      attendeeEmail: request.attendeeEmail,
      requestId: request.idempotencyKey,
    });
    return { ok: true, event, start: request.start, end };
  }
}
