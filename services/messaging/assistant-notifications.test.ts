import { describe, expect, it } from "vitest";
import { buildAssistantAlertEmails } from "./assistant-notifications";

const ctx = { brandName: "ImpulsIA", contactEmail: "contacto@impulsialabs.cl", appUrl: "https://impulsialabs.cl", currency: "CLP", locale: "es-CL", timeZone: "America/Santiago" };

describe("buildAssistantAlertEmails", () => {
  it("no envía nada si no hubo lead, derivación ni alerta de presupuesto", () => {
    expect(buildAssistantAlertEmails({ duplicate: false, conversationId: "c1" }, ctx)).toEqual([]);
  });

  it("avisa lead, derivación y presupuesto al correo de contacto", () => {
    const emails = buildAssistantAlertEmails({
      duplicate: false,
      conversationId: "c1",
      lead: { name: "Ana", company: "Demo\nSpA", email: "ana@demo.cl", need: "Conciliar pagos", goal: "Ahorrar tiempo", systems: [], interest: "alto", phone: "56911112222" },
      handoff: { reason: "Quiere negociar", priority: "alta" },
      budgetWarning: { spentUsd: 1.62, budgetUsd: 2 },
    }, ctx);

    expect(emails).toHaveLength(3);
    expect(emails.every((email) => email.to === "contacto@impulsialabs.cl")).toBe(true);
    expect(emails[0]).toMatchObject({ replyTo: "ana@demo.cl", subject: "Nuevo lead por WhatsApp: Demo SpA" });
    expect(emails[0].text).toContain("https://impulsialabs.cl/admin/conversations/c1");
    expect(emails[1].subject).toBe("[Prioridad alta] WhatsApp requiere atención humana");
    expect(emails[2].text).toContain("US$1.62 de US$2.00");
  });

  it("avisa la reunión agendada en hora de Chile", () => {
    const [email] = buildAssistantAlertEmails({
      duplicate: false,
      conversationId: "c1",
      meeting: { start: "2027-01-14T17:00:00.000Z", topic: "Diagnóstico ERP", meetLink: "https://meet.google.com/x" },
    }, ctx);

    expect(email.subject).toMatch(/^Reunión agendada por WhatsApp: jueves.*14:00/);
    expect(email.text).toContain("https://meet.google.com/x");
  });

  it("avisa la propuesta de cotización con enlace al cotizador prellenado", () => {
    const [email] = buildAssistantAlertEmails({
      duplicate: false,
      conversationId: "c1",
      leadId: "lead-9",
      quoteProposal: { name: "Integración ERP", scope: "Pedidos y stock", complexity: "medium", estimatedDays: 4, thirdPartyMonthlyCost: 0, implementationEstimate: 960_000, monthlyMaintenanceEstimate: 192_000 },
    }, ctx);

    expect(email.subject).toBe("Propuesta de cotización por revisar: Integración ERP");
    expect(email.text).toContain("No se envió nada al cliente");
    expect(email.text).toContain("https://impulsialabs.cl/admin/quotes/new?");
    expect(email.text).toContain("leadId=lead-9");
    expect(email.text).toContain("$960.000");
    expect(email.text).toContain("https://impulsialabs.cl/admin/crm/lead-9");
  });
});
