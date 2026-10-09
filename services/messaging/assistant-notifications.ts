import { buildQuotePrefillPath } from "@/domain/pricing/quote-prefill";
import { formatSlot } from "@/domain/scheduling/slots";
import type { EmailMessage, EmailProvider } from "@/integrations/email/email-provider";
import { formatMoney } from "@/lib/format";
import type { WhatsAppInboundOutcome } from "./process-whatsapp-webhook";

interface AlertContext {
  brandName: string;
  contactEmail: string;
  appUrl: string;
  currency: string;
  locale: string;
  timeZone: string;
}

const singleLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

/** Avisos internos por correo: lead nuevo, propuesta de cotización, reunión agendada, derivación a una persona y 80% del presupuesto diario. */
export function buildAssistantAlertEmails(outcome: WhatsAppInboundOutcome, ctx: AlertContext): EmailMessage[] {
  const conversationUrl = `${ctx.appUrl}/admin/conversations/${outcome.conversationId}`;
  const web = outcome.channel === "web";
  const instagram = outcome.channel === "instagram";
  const via = web ? "el chat del sitio" : instagram ? "Instagram" : "WhatsApp";
  const channelName = web ? "El chat del sitio" : instagram ? "Instagram" : "WhatsApp";
  const assistantOf = web ? "El asistente del chat del sitio" : `El asistente de ${via}`;
  const emails: EmailMessage[] = [];
  if (outcome.lead) {
    emails.push({
      to: ctx.contactEmail,
      ...(outcome.lead.email ? { replyTo: outcome.lead.email } : {}),
      subject: `Nuevo lead por ${via}: ${singleLine(outcome.lead.company)}`,
      text: [
        `El asistente de ${via} registró un nuevo lead con autorización de contacto.`,
        "",
        `Nombre: ${outcome.lead.name}`,
        `Empresa: ${outcome.lead.company}`,
        ...(outcome.lead.email ? [`Email: ${outcome.lead.email}`] : []),
        ...(outcome.lead.phone ? [web || instagram ? `Teléfono: ${outcome.lead.phone}` : `WhatsApp: +${outcome.lead.phone}`] : []),
        `Objetivo: ${outcome.lead.goal}`,
        `Interés: ${outcome.lead.interest}`,
        ...(outcome.lead.systems.length ? [`Sistemas: ${outcome.lead.systems.join(", ")}`] : []),
        "",
        "Necesidad:",
        outcome.lead.need,
        "",
        `Conversación: ${conversationUrl}`,
      ].join("\n"),
    });
  }
  if (outcome.quoteProposal) {
    const proposal = outcome.quoteProposal;
    const money = (amount: number) => formatMoney(amount, ctx.currency, ctx.locale);
    const quoteUrl = `${ctx.appUrl}${buildQuotePrefillPath({
      leadId: outcome.leadId ?? undefined,
      name: proposal.name,
      estimatedDays: proposal.estimatedDays,
      complexity: proposal.complexity,
      thirdPartyMonthlyCost: proposal.thirdPartyMonthlyCost,
      notes: proposal.scope,
    })}`;
    emails.push({
      to: ctx.contactEmail,
      ...(outcome.lead?.email ? { replyTo: outcome.lead.email } : {}),
      subject: `Propuesta de cotización por revisar: ${singleLine(proposal.name)}`,
      text: [
        `${assistantOf} preparó una propuesta de cotización. No se envió nada al cliente: revísala, ajústala y guárdala desde el cotizador.`,
        "",
        `Solución: ${proposal.name}`,
        `Jornadas estimadas: ${proposal.estimatedDays} · Complejidad: ${proposal.complexity}`,
        `Referencia sin descuentos: implementación ${money(proposal.implementationEstimate)} · mantención ${money(proposal.monthlyMaintenanceEstimate)} / mes`,
        ...(proposal.thirdPartyMonthlyCost > 0 ? [`Costo externo mensual estimado: ${money(proposal.thirdPartyMonthlyCost)}`] : []),
        "",
        "Alcance:",
        proposal.scope,
        "",
        `Abrir el cotizador prellenado: ${quoteUrl}`,
        ...(outcome.leadId ? [`Lead (para convertirlo en cuenta si aún no lo está): ${ctx.appUrl}/admin/crm/${outcome.leadId}`] : []),
        `Conversación: ${conversationUrl}`,
      ].join("\n"),
    });
  }
  if (outcome.meeting) {
    const when = formatSlot(new Date(outcome.meeting.start), ctx.locale, ctx.timeZone);
    emails.push({
      to: ctx.contactEmail,
      ...(outcome.lead?.email ? { replyTo: outcome.lead.email } : {}),
      subject: `Reunión agendada por ${via}: ${when}`,
      text: [
        `${assistantOf} agendó una reunión en el calendario y envió la invitación al cliente.`,
        "",
        `Cuándo: ${when}`,
        `Tema: ${outcome.meeting.topic}`,
        ...(outcome.meeting.meetLink ? [`Google Meet: ${outcome.meeting.meetLink}`] : []),
        "",
        `Conversación: ${conversationUrl}`,
      ].join("\n"),
    });
  }
  if (outcome.handoff) {
    emails.push({
      to: ctx.contactEmail,
      subject: `${outcome.handoff.priority === "alta" ? "[Prioridad alta] " : ""}${channelName} requiere atención humana`,
      text: [
        `El asistente derivó una conversación de ${via} al equipo.`,
        "",
        `Motivo: ${outcome.handoff.reason}`,
        "",
        `Responder desde el panel: ${conversationUrl}`,
      ].join("\n"),
    });
  }
  if (outcome.budgetWarning) {
    emails.push({
      to: ctx.contactEmail,
      subject: `${ctx.brandName}: el asistente de IA usó el 80% del presupuesto diario`,
      text: [
        `Gasto de las últimas 24 horas: US$${outcome.budgetWarning.spentUsd.toFixed(2)} de US$${outcome.budgetWarning.budgetUsd.toFixed(2)}.`,
        "Al llegar al 100%, el asistente deja de responder con IA y deriva las conversaciones nuevas al equipo hasta que baje el gasto.",
        "",
        `Revisar: ${ctx.appUrl}/admin/conversations`,
      ].join("\n"),
    });
  }
  return emails;
}

export async function sendAssistantAlerts(outcome: WhatsAppInboundOutcome, email: EmailProvider, ctx: AlertContext) {
  const results = await Promise.allSettled(buildAssistantAlertEmails(outcome, ctx).map((message) => email.send(message)));
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("assistant.alert.failed", { conversationId: outcome.conversationId, message: result.reason instanceof Error ? result.reason.message : "unknown" });
    }
  }
}
