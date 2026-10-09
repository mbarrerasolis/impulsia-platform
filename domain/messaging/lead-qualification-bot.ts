import { z } from "zod";

export const qualificationStateSchema = z.enum([
  "new",
  "awaiting_need",
  "awaiting_company",
  "awaiting_email",
  "awaiting_goal",
  "awaiting_consent",
  "qualified",
  "waiting_human",
  "closed",
  /** Conversación atendida por el asistente con IA; si se apaga la IA, el guion parte desde cero. */
  "ai_conversation",
]);

export type QualificationState = z.infer<typeof qualificationStateSchema>;

export const qualificationContextSchema = z.object({
  need: z.string().optional(),
  company: z.string().optional(),
  email: z.string().optional(),
  goal: z.string().optional(),
});

export type QualificationContext = z.infer<typeof qualificationContextSchema>;

export interface QualifiedWhatsAppLead {
  name: string;
  company: string;
  email: string;
  phone: string;
  rawNeedDescription: string;
  primaryGoal: string;
}

export interface QualificationResult {
  state: QualificationState;
  context: QualificationContext;
  reply: string | null;
  humanHandoffRequested: boolean;
  lead?: QualifiedWhatsAppLead;
}

const humanRequest = /\b(humano|persona|asesor|ejecutivo|hablar con alguien|llamada)\b/i;
const affirmative = /^(s[ií]|acepto|de acuerdo|autorizo|ok|okay)$/i;
const negative = /^(no|no acepto|no autorizo)$/i;

export function advanceLeadQualification(input: {
  state: QualificationState;
  context: QualificationContext;
  message: string;
  profileName?: string;
  phone: string;
  brandName?: string;
}): QualificationResult {
  const message = input.message.trim();
  const context = { ...input.context };
  const name = input.profileName?.trim() || "Contacto WhatsApp";
  const brandName = input.brandName?.trim() || "nuestro equipo";

  if (humanRequest.test(message)) {
    return {
      state: "waiting_human",
      context,
      humanHandoffRequested: true,
      reply: "Entendido. Dejé tu conversación marcada para que una persona del equipo continúe contigo.",
    };
  }

  switch (input.state) {
    case "new":
    case "ai_conversation":
      return {
        state: "awaiting_need",
        context,
        humanHandoffRequested: false,
        reply: `Hola ${name}. Soy el asistente de ${brandName}. ¿Qué proceso o tarea te gustaría mejorar o automatizar?`,
      };
    case "awaiting_need":
      if (message.length < 5) return { state: input.state, context, humanHandoffRequested: false, reply: "Cuéntame un poco más sobre el proceso que hoy te quita tiempo o genera errores." };
      context.need = message;
      return { state: "awaiting_company", context, humanHandoffRequested: false, reply: "Gracias. ¿Cuál es el nombre de tu empresa?" };
    case "awaiting_company":
      if (message.length < 2) return { state: input.state, context, humanHandoffRequested: false, reply: "Necesito el nombre de tu empresa para continuar." };
      context.company = message;
      return { state: "awaiting_email", context, humanHandoffRequested: false, reply: "¿A qué email de trabajo podemos enviarte el diagnóstico?" };
    case "awaiting_email": {
      const email = z.email().safeParse(message.toLowerCase());
      if (!email.success) return { state: input.state, context, humanHandoffRequested: false, reply: "Ese email no parece válido. Escríbelo nuevamente, por favor." };
      context.email = email.data;
      return { state: "awaiting_goal", context, humanHandoffRequested: false, reply: "¿Cuál es tu objetivo principal: ahorrar tiempo, reducir errores, responder más rápido, vender más o mejorar el control?" };
    }
    case "awaiting_goal":
      if (message.length < 3) return { state: input.state, context, humanHandoffRequested: false, reply: "Indica brevemente el resultado principal que buscas." };
      context.goal = message;
      return { state: "awaiting_consent", context, humanHandoffRequested: false, reply: `Para crear tu diagnóstico, ¿autorizas a ${brandName} a contactarte sobre esta solicitud? Responde SÍ o NO.` };
    case "awaiting_consent":
      if (negative.test(message)) return { state: "closed", context, humanHandoffRequested: false, reply: "Entendido. No crearemos un lead ni enviaremos seguimiento. Puedes volver a escribir cuando quieras." };
      if (!affirmative.test(message)) return { state: input.state, context, humanHandoffRequested: false, reply: "Necesito una respuesta explícita: SÍ para autorizar el contacto o NO para cerrar la conversación." };
      if (!context.need || !context.company || !context.email || !context.goal) {
        return { state: "new", context: {}, humanHandoffRequested: false, reply: "Necesito comenzar nuevamente para completar correctamente tus datos." };
      }
      return {
        state: "qualified",
        context,
        humanHandoffRequested: true,
        reply: "¡Listo! Registré tu solicitud y la derivé al equipo. Te contactaremos para revisar el proceso y proponer el siguiente paso.",
        lead: {
          name,
          company: context.company,
          email: context.email,
          phone: input.phone,
          rawNeedDescription: context.need,
          primaryGoal: context.goal,
        },
      };
    case "qualified":
    case "waiting_human":
      return { state: input.state, context, humanHandoffRequested: true, reply: null };
    case "closed":
      return { state: input.state, context, humanHandoffRequested: false, reply: null };
  }
}
