import { describe, expect, it, vi } from "vitest";
import { ResendEmailProvider } from "./resend-email-provider";

describe("ResendEmailProvider", () => {
  it("envía el mensaje a la API de Resend con autorización y reply_to", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }));
    const provider = new ResendEmailProvider({ apiKey: "re_test", from: "ImpulsIA <hola@send.example.com>" }, fetchMock);
    const result = await provider.send({ to: "a@example.com", subject: "Hola", text: "Cuerpo", replyTo: "b@example.com" });

    expect(result.externalMessageId).toBe("msg_123");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({
      from: "ImpulsIA <hola@send.example.com>",
      to: ["a@example.com"],
      subject: "Hola",
      text: "Cuerpo",
      reply_to: "b@example.com"
    });
  });

  it("lanza un error descriptivo si Resend rechaza el envío", async () => {
    const fetchMock = vi.fn(async () => new Response("domain not verified", { status: 403 }));
    const provider = new ResendEmailProvider({ apiKey: "re_test", from: "x@example.com" }, fetchMock);
    await expect(provider.send({ to: "a@example.com", subject: "s", text: "t" })).rejects.toThrow("Resend respondió 403");
  });
});
