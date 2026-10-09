import { describe, expect, it } from "vitest";
import { advanceLeadQualification, type QualificationContext, type QualificationState } from "./lead-qualification-bot";

function advance(state: QualificationState, context: QualificationContext, message: string) {
  return advanceLeadQualification({ state, context, message, profileName: "Ana", phone: "56912345678" });
}

describe("WhatsApp lead qualification", () => {
  it("completa el flujo con consentimiento explícito", () => {
    let state: QualificationState = "new";
    let context: QualificationContext = {};
    for (const message of ["Hola", "Quiero automatizar la conciliación mensual", "Empresa Uno", "ana@empresa.cl", "Ahorrar tiempo", "Sí"]) {
      const result = advance(state, context, message);
      state = result.state;
      context = result.context;
      if (result.lead) {
        expect(result.lead).toMatchObject({ company: "Empresa Uno", email: "ana@empresa.cl", phone: "56912345678" });
      }
    }
    expect(state).toBe("qualified");
  });

  it("no crea un lead cuando la persona rechaza el contacto", () => {
    const result = advance("awaiting_consent", {
      need: "Automatizar pedidos",
      company: "Empresa Uno",
      email: "ana@empresa.cl",
      goal: "Reducir errores",
    }, "No");
    expect(result.state).toBe("closed");
    expect(result.lead).toBeUndefined();
  });

  it("prioriza una solicitud de atención humana", () => {
    const result = advance("awaiting_need", {}, "Quiero hablar con una persona");
    expect(result.state).toBe("waiting_human");
    expect(result.humanHandoffRequested).toBe(true);
  });
});
