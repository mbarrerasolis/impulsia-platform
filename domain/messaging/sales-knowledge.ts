import { z } from "zod";

/**
 * Conocimiento comercial del asistente de WhatsApp: quién está detrás de la empresa, experiencia
 * real demostrable y cómo vender. Todo lo que el asistente afirme sobre experiencia debe salir de aquí.
 */
const experienceSchema = z.object({
  title: z.string().trim().min(3).max(120),
  context: z.string().trim().min(10).max(400),
  built: z.string().trim().min(10).max(500),
  outcome: z.string().trim().min(5).max(300),
  /** Frases de dolor del cliente que indican que este caso es relevante. */
  relevantWhen: z.array(z.string().trim().min(2).max(120)).max(16).default([]),
});

/** Paquete con precio cerrado para un perfil de cliente: se cita tal cual, sin estimar_precio. */
const fixedOfferSchema = z.object({
  name: z.string().trim().min(3).max(120),
  /** Para quién es y cuándo ofrecerlo. */
  audience: z.string().trim().min(10).max(300),
  includes: z.array(z.string().trim().min(3).max(160)).min(1).max(12),
  /** Montos en la moneda de la edición, sin impuestos. */
  implementation: z.number().int().positive(),
  monthly: z.number().int().positive(),
  /** Condiciones: impuestos, carácter promocional, qué se revisa en el diagnóstico. */
  conditions: z.array(z.string().trim().min(5).max(240)).max(6).default([]),
});

const objectionSchema = z.object({
  objection: z.string().trim().min(3).max(160),
  approach: z.string().trim().min(10).max(400),
});

export const salesKnowledgeSchema = z.object({
  /** Nombre con que se presenta el asistente; sin él, se presenta como asistente con IA. */
  assistantName: z.string().trim().min(2).max(60).optional(),
  founder: z.object({
    name: z.string().trim().min(2).max(80),
    role: z.string().trim().min(2).max(120),
    summary: z.string().trim().min(20).max(800),
  }),
  experience: z.array(experienceSchema).max(10),
  strengths: z.array(z.string().trim().min(5).max(200)).max(12),
  /** Qué sabe hacer técnicamente; se usa cuando el cliente pregunta cómo o necesita confianza técnica. */
  technicalCapabilities: z.array(z.string().trim().min(5).max(220)).max(15).default([]),
  /** Cómo se implementa por dentro (stack, seguridad, método); sólo para preguntas técnicas. */
  implementationDetails: z.array(z.string().trim().min(5).max(260)).max(15).default([]),
  /** Cómo dimensionar jornadas reales de trabajo para estimar_precio (referencias y qué las sube). */
  effortGuide: z.array(z.string().trim().min(5).max(400)).max(12).default([]),
  /** Ofertas de precio cerrado por perfil; tienen prioridad sobre estimar_precio cuando el caso calza. */
  fixedOffers: z.array(fixedOfferSchema).max(6).default([]),
  /** Lo que el asistente no debe prometer. */
  limits: z.array(z.string().trim().min(5).max(200)).max(10).default([]),
  /** Cómo invitar a la reunión (formato, duración, sin costo). */
  meetingPitch: z.string().trim().min(20).max(500).optional(),
  idealClients: z.string().trim().min(10).max(500),
  objections: z.array(objectionSchema).max(12),
});

export type SalesKnowledge = z.infer<typeof salesKnowledgeSchema>;

export function parseSalesKnowledge(input: unknown): SalesKnowledge {
  return salesKnowledgeSchema.parse(input);
}

/** Sección del prompt con la experiencia real; se cita sólo lo que está aquí. */
export function formatSalesKnowledge(knowledge: SalesKnowledge, formatMoney: (amount: number) => string = (amount) => `${amount.toLocaleString("es-CL")}`) {
  const experience = knowledge.experience.map((item) => [
    `- ${item.title}: ${item.context}`,
    `  Qué se construyó: ${item.built}`,
    `  Resultado: ${item.outcome}`,
    ...(item.relevantWhen.length ? [`  Úsalo cuando el cliente mencione: ${item.relevantWhen.join(", ")}.`] : []),
  ].join("\n")).join("\n");
  const objections = knowledge.objections.map((item) => `- "${item.objection}": ${item.approach}`).join("\n");
  return `Quién está detrás:
${knowledge.founder.name}, ${knowledge.founder.role}. ${knowledge.founder.summary}

Experiencia real que puedes mencionar (sólo esta; no inventes clientes, cifras ni resultados):
${experience}

Fortalezas:
${knowledge.strengths.map((item) => `- ${item}`).join("\n")}

${knowledge.technicalCapabilities.length ? `Capacidades técnicas (menciónalas cuando el cliente pregunte cómo se hace o necesite confianza técnica, en lenguaje simple y sin abrumar):
${knowledge.technicalCapabilities.map((item) => `- ${item}`).join("\n")}

` : ""}${knowledge.implementationDetails.length ? `Detalle técnico de implementación (úsalo sólo si el cliente pregunta cómo se construye, qué tecnología se usa o cómo se protegen sus datos; adapta el nivel técnico a quien pregunta y no lo sueltes todo de una vez):
${knowledge.implementationDetails.map((item) => `- ${item}`).join("\n")}

` : ""}${knowledge.effortGuide.length ? `Cómo dimensionar las jornadas para estimar_precio (el precio sale de las jornadas: no las infles por cantidad de pantallas o funciones, sino por lo que realmente cuesta):
${knowledge.effortGuide.map((item) => `- ${item}`).join("\n")}

` : ""}${knowledge.fixedOffers.length ? `Ofertas con precio cerrado (si el caso calza, da este precio tal cual y no uses estimar_precio; son la excepción al precio mínimo general):
${knowledge.fixedOffers.map((offer) => [
    `- ${offer.name}: ${formatMoney(offer.implementation)} de implementación y ${formatMoney(offer.monthly)} mensuales.`,
    `  Para quién: ${offer.audience}`,
    `  Incluye: ${offer.includes.join("; ")}.`,
    ...offer.conditions.map((condition) => `  ${condition}`),
  ].join("\n")).join("\n")}

` : ""}${knowledge.limits.length ? `No prometas (si lo piden, dilo con honestidad y ofrece evaluarlo en la reunión):
${knowledge.limits.map((item) => `- ${item}`).join("\n")}

` : ""}Cliente ideal: ${knowledge.idealClients}${knowledge.meetingPitch ? `

Cómo invitar a la reunión: ${knowledge.meetingPitch}` : ""}

Objeciones frecuentes y cómo abordarlas:
${objections}`;
}
