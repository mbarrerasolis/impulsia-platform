import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ EMAIL_PROVIDER: "mock" }) }));
vi.mock("@/lib/brand", () => ({ getBrandConfig: () => ({ contactEmail: "contacto@x.cl", notificationCc: [] }) }));

import { withTeamCopy } from "./index";

describe("copia de avisos al equipo", () => {
  const brand = { contactEmail: "contacto@x.cl", notificationCc: ["N.t@gmail.com", "contacto@x.cl"] };

  it("agrega la copia sólo a los avisos dirigidos al equipo", async () => {
    const send = vi.fn(async () => ({ externalMessageId: "1" }));
    const provider = withTeamCopy({ send }, brand);
    await provider.send({ to: "Contacto@x.cl", subject: "Pedido", text: "…" });
    await provider.send({ to: "cliente@gmail.com", subject: "Gracias", text: "…" });
    expect(send.mock.calls[0]).toEqual([{ to: "Contacto@x.cl", subject: "Pedido", text: "…", cc: ["N.t@gmail.com"] }]);
    expect(send.mock.calls[1]).toEqual([{ to: "cliente@gmail.com", subject: "Gracias", text: "…" }]);
  });

  it("sin copias configuradas no cambia nada", () => {
    const base = { send: vi.fn() };
    expect(withTeamCopy(base, { contactEmail: "a@x.cl", notificationCc: [] })).toBe(base);
  });
});
