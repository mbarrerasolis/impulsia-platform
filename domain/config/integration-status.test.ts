import { describe, expect, it } from "vitest";
import { integrationStatuses } from "./integration-status";

const storeModules = { whatsapp: true, store: true, meetings: false, subscriptions: false };

describe("estado de integraciones", () => {
  it("muestra qué falta sin exponer valores", () => {
    const list = integrationStatuses({ env: { APP_MODE: "supabase", AI_PROVIDER: "mock", EMAIL_PROVIDER: "mock", PAYMENT_PROVIDER: "mock", RESEND_API_KEY: "re_secreto" }, modules: storeModules, assistant: { name: "Claudia", hasStyle: false } });
    const byKey = Object.fromEntries(list.map((item) => [item.key, item]));
    expect(byKey.database.state).toBe("ok");
    expect(byKey.assistant).toMatchObject({ name: "Claudia (asistente con IA)", state: "off", missing: ["AI_PROVIDER=anthropic", "ANTHROPIC_API_KEY"] });
    expect(byKey["web-chat"].state).toBe("off");
    expect(byKey.whatsapp.missing).toContain("NEXT_PUBLIC_WHATSAPP_NUMBER");
    expect(byKey.payments.detail).toContain("el equipo confirma y cobra");
    expect(byKey.calendar).toBeUndefined();
    expect(JSON.stringify(list)).not.toContain("re_secreto");
  });

  it("marca el asistente como parcial mientras use el estilo neutro", () => {
    const list = integrationStatuses({ env: { APP_MODE: "supabase", AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "x", AI_MODEL: "claude-sonnet-5", AI_DAILY_BUDGET_USD: 5 }, modules: storeModules, assistant: { name: "Claudia", hasStyle: false } });
    const assistant = list.find((item) => item.key === "assistant")!;
    expect(assistant.state).toBe("partial");
    expect(list.find((item) => item.key === "web-chat")!.state).toBe("ok");
  });
});
