import { z } from "zod";
import type { Lead } from "@/domain/crm/entities";
import { parseLeadAttribution } from "@/domain/marketing/attribution";
import type { LeadRepository } from "@/repositories/lead-repository";

export const createLeadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(140),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  rawNeedDescription: z.string().trim().max(3_000).optional().or(z.literal("")),
  systems: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  apiKnowledge: z.enum(["yes", "no", "unknown"]).default("unknown"),
  peopleInvolved: z.number().int().min(0).max(100_000).optional(),
  hoursPerMonth: z.number().min(0).max(1_000_000).optional(),
  monthlyVolume: z.number().int().min(0).max(1_000_000_000).optional(),
  primaryGoal: z.string().trim().min(2).max(200),
  consentGiven: z.literal(true),
  // Lo inválido se descarta: un origen mal formado nunca debe impedir guardar el lead.
  attribution: z.unknown().optional().transform(parseLeadAttribution)
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

function scoreLead(input: CreateLeadInput) {
  let score = 25;
  if ((input.hoursPerMonth ?? 0) >= 40) score += 25;
  if ((input.peopleInvolved ?? 0) >= 3) score += 15;
  if ((input.monthlyVolume ?? 0) >= 100) score += 20;
  if (input.systems.length >= 2) score += 15;
  return Math.min(score, 100);
}

/**
 * Topes del formulario público. Cada lead web dispara correos (uno de ellos al email ingresado),
 * así que limitan tanto el abuso contra un destinatario como el volumen total ante un ataque.
 */
export const leadSubmissionLimits = { perEmailPerDay: 3, totalPerHour: 20 };

export class LeadRateLimitError extends Error {
  constructor(readonly scope: "email" | "total") {
    super(scope === "email" ? "Límite de solicitudes por email alcanzado." : "Límite global de solicitudes alcanzado.");
  }
}

const hourMs = 60 * 60 * 1000;

export class CreateLeadService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly limits = leadSubmissionLimits,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** Lanza `LeadRateLimitError` si el correo o el total superan los topes; un fallo al contar no bloquea. */
  async enforceLimits(email: string) {
    const now = this.now().getTime();
    let byEmail: number, total: number;
    try {
      [byEmail, total] = await Promise.all([
        this.leads.countWebLeadsSince(new Date(now - 24 * hourMs).toISOString(), email),
        this.leads.countWebLeadsSince(new Date(now - hourMs).toISOString())
      ]);
    } catch (error) {
      // Si el conteo falla, se prioriza no perder un prospecto real: el lead se guarda igual.
      console.error("lead.rate_limit.unavailable", { message: error instanceof Error ? error.message : "unknown" });
      return;
    }
    if (byEmail >= this.limits.perEmailPerDay) throw new LeadRateLimitError("email");
    if (total >= this.limits.totalPerHour) throw new LeadRateLimitError("total");
  }

  /** `checkLimits: false` cuando el llamador ya aplicó `enforceLimits` (p. ej. antes de reservar una reunión). */
  async execute(unknownInput: unknown, options: { checkLimits?: boolean } = {}): Promise<Lead> {
    const input = createLeadSchema.parse(unknownInput);
    if (options.checkLimits !== false) await this.enforceLimits(input.email);
    return this.leads.create({
      ...input,
      phone: input.phone || undefined,
      rawNeedDescription: input.rawNeedDescription || "Por definir en la llamada de diagnóstico.",
      source: "web",
      status: "new",
      score: scoreLead(input)
    });
  }
}
