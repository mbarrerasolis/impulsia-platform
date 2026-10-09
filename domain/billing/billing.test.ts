import { describe, expect, it } from "vitest";
import { canTransitionPayment } from "./payment";
import { schedulePaymentReminders } from "./reminders";

describe("payment status", () => {
  it("acepta aprobación e impide reabrir un pago aprobado", () => {
    expect(canTransitionPayment("pending", "approved")).toBe(true);
    expect(canTransitionPayment("approved", "pending")).toBe(false);
  });
});

describe("reminder scheduling", () => {
  it("crea cinco avisos y una alerta manual", () => {
    const reminders = schedulePaymentReminders(new Date("2026-09-20T12:00:00Z"));
    expect(reminders).toHaveLength(6);
    expect(reminders[0].scheduledAt.toISOString()).toBe("2026-09-15T12:00:00.000Z");
    expect(reminders.at(-1)?.kind).toBe("manual_alert");
  });
});
