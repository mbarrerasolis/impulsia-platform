import { z } from "zod";
import type { Lead } from "@/domain/crm/entities";
import { interestSignalScores } from "@/domain/crm/lead-temperature";
import { formatSlot } from "@/domain/scheduling/slots";
import type { LeadRepository } from "@/repositories/lead-repository";
import type { BookingResult, MeetingRequest } from "@/services/messaging/meeting-scheduler";
import type { SchedulingRules } from "@/domain/scheduling/slots";
import { CreateLeadService } from "./create-lead";

export const webMeetingSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(140),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  // WhatsApp para recordar o reagendar: en este rubro es el canal que sí se lee.
  phone: z.string().trim().min(8).max(30).regex(/^[+\d\s()-]+$/),
  topic: z.string().trim().max(500).optional().or(z.literal("")),
  start: z.iso.datetime(),
  consentGiven: z.literal(true),
  attribution: z.unknown().optional(),
});

export interface WebMeetingScheduler {
  readonly rules: SchedulingRules;
  book(request: MeetingRequest): Promise<BookingResult>;
}

export type WebMeetingResult =
  | { ok: true; lead: Lead; start: Date; end: Date; meetLink?: string; slotLabel: string }
  | { ok: false; reason: "outside_rules" | "busy" };

const defaultTopic = "Diagnóstico gratuito";

/**
 * Agenda una reunión elegida en la página pública y registra al prospecto como lead caliente.
 * Primero aplica los topes del formulario (la invitación de Google llega al email ingresado), luego reserva
 * el horario (idempotente por email y horario) y al final crea el lead, sin volver a contar los topes.
 */
export class BookWebMeetingService {
  private readonly createLead: CreateLeadService;

  constructor(private readonly leads: LeadRepository, private readonly scheduler: WebMeetingScheduler, createLead?: CreateLeadService) {
    this.createLead = createLead ?? new CreateLeadService(leads);
  }

  async execute(unknownInput: unknown): Promise<WebMeetingResult> {
    const input = webMeetingSchema.parse(unknownInput);
    await this.createLead.enforceLimits(input.email);
    const start = new Date(input.start);
    const topic = input.topic || defaultTopic;
    const booked = await this.scheduler.book({
      start,
      topic: topic.slice(0, 120),
      attendeeEmail: input.email,
      attendeeName: input.name,
      company: input.company,
      origin: "desde la página de agenda del sitio",
      idempotencyKey: `web:${input.email}:${start.toISOString()}`,
    });
    if (!booked.ok) return booked;

    const slotLabel = formatSlot(start, "es-CL", this.scheduler.rules.timeZone);
    const lead = await this.createLead.execute({
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone,
      rawNeedDescription: [`Reunión agendada desde la web para el ${slotLabel}.`, input.topic ? `Lo que quiere conversar: ${input.topic}` : ""].filter(Boolean).join("\n"),
      primaryGoal: "Reunión de diagnóstico agendada desde la web",
      consentGiven: true,
      attribution: input.attribution,
    }, { checkLimits: false });
    // Agendar es la señal de interés más fuerte: el lead queda caliente igual que si agendara por WhatsApp.
    const score = Math.max(lead.score, interestSignalScores.meeting);
    if (score > lead.score) await this.leads.updateScore(lead.id, score);
    return { ok: true, lead: { ...lead, score }, start: booked.start, end: booked.end, meetLink: booked.event.meetLink, slotLabel };
  }
}
