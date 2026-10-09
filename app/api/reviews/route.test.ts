import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const countPendingSince = vi.fn();

vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ APP_MODE: "demo" }) }));
vi.mock("@/lib/business", () => ({ moduleDisabledResponse: () => undefined }));
vi.mock("@/repositories", () => ({ getReviewRepository: () => ({ create, countPendingSince }) }));

import { POST } from "./route";

const send = (body: unknown) => POST(new Request("https://distribuidorasecos.cl/api/reviews", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
}));

const valid = { rating: 5, body: "La nuez llegó fresca y rápido.", authorName: "Carolina Muñoz", productLabel: "Nuez cuartillo", contact: "", website: "", elapsedMs: 8_000 };

describe("public reviews endpoint", () => {
  beforeEach(() => { create.mockReset(); countPendingSince.mockReset().mockResolvedValue(0); });

  it("guarda la reseña para revisión, sin las señales anti-bot", async () => {
    const response = await send(valid);
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith({ rating: 5, body: "La nuez llegó fresca y rápido.", authorName: "Carolina Muñoz", productLabel: "Nuez cuartillo", contact: undefined });
  });

  it("descarta en silencio los envíos de bots", async () => {
    expect((await send({ ...valid, website: "https://spam.example" })).status).toBe(201);
    expect((await send({ ...valid, elapsedMs: 400 })).status).toBe(201);
    expect(create).not.toHaveBeenCalled();
  });

  it("explica qué corregir cuando faltan datos", async () => {
    const response = await send({ ...valid, rating: 0 });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Elige de 1 a 5 estrellas." });
    expect(create).not.toHaveBeenCalled();
  });

  it("deja de aceptar reseñas si llegan demasiadas por hora", async () => {
    countPendingSince.mockResolvedValue(30);
    expect((await send(valid)).status).toBe(429);
    expect(create).not.toHaveBeenCalled();
  });
});
