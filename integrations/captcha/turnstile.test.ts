import { describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "./turnstile";

describe("verifyTurnstileToken", () => {
  it("envía secreto, token e IP a siteverify y acepta success", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    await expect(verifyTurnstileToken({ secret: "s3cret", token: "tok", remoteIp: "1.2.3.4" }, fetchMock)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({ secret: "s3cret", response: "tok", remoteip: "1.2.3.4" });
  });

  it("rechaza tokens inválidos, respuestas de error y fallos de red", async () => {
    const invalid = vi.fn(async () => new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 }));
    expect(await verifyTurnstileToken({ secret: "s", token: "t" }, invalid)).toBe(false);
    const serverError = vi.fn(async () => new Response("", { status: 500 }));
    expect(await verifyTurnstileToken({ secret: "s", token: "t" }, serverError)).toBe(false);
    const offline = vi.fn(async () => { throw new TypeError("fetch failed"); });
    expect(await verifyTurnstileToken({ secret: "s", token: "t" }, offline)).toBe(false);
  });
});
