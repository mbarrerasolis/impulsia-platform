import type { Lead } from "@/domain/crm/entities";
import type { EmailProvider } from "@/integrations/email/email-provider";

interface NotificationContext {
  brandName: string;
  contactEmail: string;
  appUrl: string;
}

const apiKnowledgeLabels: Record<Lead["apiKnowledge"], string> = { yes: "Sí", no: "No", unknown: "No sabe" };

/** Quita saltos de línea para que datos del formulario no alteren el asunto. */
const singleLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

export function buildInternalLeadEmail(lead: Lead, ctx: NotificationContext) {
  const optional = (label: string, value?: string | number) => value === undefined || value === "" ? [] : [`${label}: ${value}`];
  return {
    to: ctx.contactEmail,
    replyTo: lead.email,
    subject: `Nuevo diagnóstico: ${singleLine(lead.company)} (score ${lead.score}/100)`,
    text: [
      `Llegó un nuevo diagnóstico desde la web.`,
      ``,
      `Nombre: ${lead.name}`,
      `Empresa: ${lead.company}`,
      `Email: ${lead.email}`,
      ...optional("Teléfono", lead.phone),
      `Objetivo principal: ${lead.primaryGoal}`,
      ...optional("Sistemas", lead.systems.join(", ")),
      `Conoce APIs: ${apiKnowledgeLabels[lead.apiKnowledge]}`,
      ...optional("Personas involucradas", lead.peopleInvolved),
      ...optional("Horas al mes", lead.hoursPerMonth),
      ...optional("Volumen mensual", lead.monthlyVolume),
      `Score: ${lead.score}/100`,
      ``,
      `Necesidad:`,
      lead.rawNeedDescription,
      ``,
      `Ver en el CRM: ${ctx.appUrl}/admin/crm/${lead.id}`,
      `Responde este correo para escribirle directamente a ${lead.name}.`
    ].join("\n")
  };
}

export function buildLeadConfirmationEmail(lead: Lead, ctx: NotificationContext) {
  return {
    to: lead.email,
    replyTo: ctx.contactEmail,
    subject: `Recibimos tu diagnóstico · ${ctx.brandName}`,
    text: [
      `Hola ${singleLine(lead.name)},`,
      ``,
      `Gracias por completar el diagnóstico de ${singleLine(lead.company)}. Ya lo recibimos y nuestro equipo lo revisará para contactarte con los próximos pasos.`,
      ``,
      `Si quieres agregar información o tienes alguna duda, solo responde este correo o escríbenos a ${ctx.contactEmail}.`,
      ``,
      `Saludos,`,
      `Equipo ${ctx.brandName}`,
      ctx.appUrl
    ].join("\n")
  };
}

/** Aviso interno de una reunión agendada desde la web; la invitación al prospecto la envía Google Calendar. */
export function buildInternalMeetingEmail(lead: Lead, meeting: { slotLabel: string; meetLink?: string }, ctx: NotificationContext) {
  const origin = lead.attribution
    ? [lead.attribution.utmSource, lead.attribution.utmMedium, lead.attribution.utmCampaign, lead.attribution.utmContent].filter(Boolean).join(" / ")
    : "";
  return {
    to: ctx.contactEmail,
    replyTo: lead.email,
    subject: `Reunión agendada: ${singleLine(lead.company)} · ${singleLine(meeting.slotLabel)}`,
    text: [
      `Se agendó una reunión desde la página de agenda.`,
      ``,
      `Cuándo: ${meeting.slotLabel}`,
      ...(meeting.meetLink ? [`Meet: ${meeting.meetLink}`] : []),
      ``,
      `Nombre: ${lead.name}`,
      `Negocio: ${lead.company}`,
      `Email: ${lead.email}`,
      ...(lead.phone ? [`WhatsApp: ${lead.phone}`] : []),
      ...(origin ? [`Origen: ${origin}`] : []),
      ``,
      lead.rawNeedDescription,
      ``,
      `Ver en el CRM: ${ctx.appUrl}/admin/crm/${lead.id}`,
    ].join("\n")
  };
}

/** Envía aviso interno y confirmación al prospecto; un fallo en uno no bloquea el otro. */
export async function sendLeadNotifications(lead: Lead, email: EmailProvider, ctx: NotificationContext) {
  const results = await Promise.allSettled([
    email.send(buildInternalLeadEmail(lead, ctx)),
    email.send(buildLeadConfirmationEmail(lead, ctx))
  ]);
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  for (const failure of failures) {
    console.error("lead.notification.failed", { leadId: lead.id, message: failure.reason instanceof Error ? failure.reason.message : "unknown" });
  }
  return { sent: results.length - failures.length, failed: failures.length };
}
