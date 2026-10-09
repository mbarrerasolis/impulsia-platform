import { describe, expect, it } from "vitest";
import type { Lead } from "@/domain/crm/entities";
import type { EmailProvider } from "@/integrations/email/email-provider";
import { MockEmailProvider } from "@/integrations/email/mock-email-provider";
import { sendLeadNotifications } from "./lead-notifications";

const ctx = { brandName: "ImpulsIA", contactEmail: "contacto@impulsialabs.cl", appUrl: "https://impulsialabs.cl" };
const lead: Lead = {
  id: "lead_1",
  source: "web",
  name: "Persona Demo",
  company: "Empresa\nDemo",
  email: "demo@example.com",
  rawNeedDescription: "Automatizar facturas.",
  systems: ["ERP"],
  apiKnowledge: "unknown",
  primaryGoal: "Ahorrar tiempo",
  status: "new",
  score: 60,
  consentGiven: true,
  createdAt: "2026-09-23T00:00:00.000Z"
};

describe("sendLeadNotifications", () => {
  it("avisa al equipo y confirma al prospecto con reply-to cruzado", async () => {
    const email = new MockEmailProvider();
    const result = await sendLeadNotifications(lead, email, ctx);

    expect(result).toEqual({ sent: 2, failed: 0 });
    const [internal, confirmation] = email.sent;
    expect(internal.to).toBe("contacto@impulsialabs.cl");
    expect(internal.replyTo).toBe("demo@example.com");
    expect(internal.subject).toBe("Nuevo diagnóstico: Empresa Demo (score 60/100)");
    expect(internal.text).toContain("https://impulsialabs.cl/admin/crm/lead_1");
    expect(confirmation.to).toBe("demo@example.com");
    expect(confirmation.replyTo).toBe("contacto@impulsialabs.cl");
  });

  it("no falla si uno de los envíos es rechazado", async () => {
    let calls = 0;
    const flaky: EmailProvider = { send: async () => { if (calls++ === 0) throw new Error("boom"); return { externalMessageId: "ok" }; } };
    await expect(sendLeadNotifications(lead, flaky, ctx)).resolves.toEqual({ sent: 1, failed: 1 });
  });
});
