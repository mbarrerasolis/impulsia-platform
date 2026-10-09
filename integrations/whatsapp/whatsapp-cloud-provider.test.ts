import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaTooLargeError, WhatsAppCloudProvider } from "./whatsapp-cloud-provider";

const provider = new WhatsAppCloudProvider({ accessToken: "token-de-prueba", phoneNumberId: "111", graphVersion: "v26.0" });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("WhatsAppCloudProvider activación", () => {
  it("registra el número con el PIN y suscribe la cuenta a la app", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await provider.registerPhoneNumber("123456");
    await provider.subscribeBusinessAccount("999");

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://graph.facebook.com/v26.0/111/register");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toEqual({ messaging_product: "whatsapp", pin: "123456" });
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://graph.facebook.com/v26.0/999/subscribed_apps");
  });

  it("rechaza PIN inválidos y muestra el error de Meta sin el token", async () => {
    await expect(provider.registerPhoneNumber("12ab")).rejects.toThrow("6 dígitos");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(json({ error: { message: "Invalid PIN", code: 100 } }, 400)));
    const failure = await provider.registerPhoneNumber("123456").catch((error: Error) => error.message);
    expect(failure).toBe("Meta respondió 400: Invalid PIN");
    expect(failure).not.toContain("token-de-prueba");
  });
});

describe("WhatsAppCloudProvider archivos", () => {
  it("descarga un adjunto con el token y normaliza el tipo", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1", mime_type: "audio/ogg; codecs=opus", file_size: 4 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4])));
    vi.stubGlobal("fetch", fetchMock);

    const media = await provider.downloadMedia("123", 1_000);

    expect(media).toEqual({ data: Buffer.from([1, 2, 3, 4]), mimeType: "audio/ogg" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://graph.facebook.com/v26.0/123");
    expect(new Headers(fetchMock.mock.calls[1][1]!.headers).get("authorization")).toBe("Bearer token-de-prueba");
  });

  it("no baja archivos demasiado grandes ni manda el token fuera de Meta", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(json({ url: "https://lookaside.fbsbx.com/x", mime_type: "application/pdf", file_size: 50_000_000 })));
    await expect(provider.downloadMedia("123", 1_000)).rejects.toBeInstanceOf(MediaTooLargeError);

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({ url: "https://evil.example.com/x", mime_type: "image/jpeg" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(provider.downloadMedia("123", 1_000)).rejects.toThrow("URL de descarga inesperada");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sube un audio y lo envía como nota de voz", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ id: "media-1" }))
      .mockResolvedValueOnce(json({ messages: [{ id: "wamid.out" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const mediaId = await provider.uploadMedia(Buffer.from([1]), "audio/ogg", "respuesta.ogg");
    const sent = await provider.sendAudio("56911112222", mediaId);

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://graph.facebook.com/v26.0/111/media");
    expect(sent).toBe("wamid.out");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]!.body))).toEqual({
      messaging_product: "whatsapp", recipient_type: "individual", to: "56911112222", type: "audio", audio: { id: "media-1", voice: true },
    });
  });
});
