import { afterEach, describe, expect, it, vi } from "vitest";
import { mediaFromStoredMessage } from "@/integrations/whatsapp/webhook";
import { InstagramMessagingProvider, splitInstagramText } from "./instagram-provider";
import { extractInboundInstagramMessages } from "./webhook";

const payload = (messaging: unknown[]) => ({ object: "instagram", entry: [{ id: "17841400000000000", time: 1789992000000, messaging }] });
const event = (message: Record<string, unknown>) => ({ sender: { id: "900111" }, recipient: { id: "17841400000000000" }, timestamp: 1789992000000, message: { mid: "aWdfZAm1", ...message } });

afterEach(() => vi.unstubAllGlobals());

describe("webhook de Instagram", () => {
  it("normaliza mensajes de texto al formato del asistente", () => {
    const [message] = extractInboundInstagramMessages(payload([event({ text: "Hola, quiero automatizar mi agenda" })]));
    expect(message).toMatchObject({
      externalId: "aWdfZAm1",
      phoneNumberId: "17841400000000000",
      sender: "900111",
      body: "Hola, quiero automatizar mi agenda",
      type: "text",
      sentAt: new Date(1789992000000).toISOString(),
    });
  });

  it("lleva fotos y audios como adjuntos recuperables desde metadata", () => {
    const [photo, voice] = extractInboundInstagramMessages(payload([
      event({ attachments: [{ type: "image", payload: { url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1" } }] }),
      { ...event({ attachments: [{ type: "audio", payload: { url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=2" } }] }), message: { mid: "aWdfZAm2", attachments: [{ type: "audio", payload: { url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=2" } }] } },
    ]));
    expect(photo.body).toBe("[Imagen]");
    expect(mediaFromStoredMessage(photo.raw)).toEqual({ kind: "image", id: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1" });
    expect(voice.body).toBe("[Nota de voz sin transcribir]");
    expect(voice.media).toMatchObject({ kind: "audio", voice: true });
  });

  it("ignora ecos, borrados y eventos sin mensaje; describe lo compartido", () => {
    const messages = extractInboundInstagramMessages(payload([
      event({ text: "respuesta nuestra", is_echo: true }),
      event({ is_deleted: true }),
      { sender: { id: "900111" }, recipient: { id: "1" }, timestamp: 1, read: { mid: "x" } },
      event({ attachments: [{ type: "share", payload: { url: "https://www.instagram.com/p/abc" } }] }),
    ]));
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toBe("[Publicación compartida]");
    expect(extractInboundInstagramMessages({ object: "whatsapp_business_account", entry: [] })).toEqual([]);
  });
});

describe("InstagramMessagingProvider", () => {
  const provider = new InstagramMessagingProvider({ accessToken: "ig-token-de-prueba-largo", accountId: "17841400000000000", graphVersion: "v25.0" });

  it("parte los textos largos en piezas de hasta 1000 bytes sin cortar palabras", () => {
    const text = `${"Automatizamos procesos con IA. ".repeat(40)}Fin.`;
    const parts = splitInstagramText(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(Buffer.byteLength(part, "utf8")).toBeLessThanOrEqual(1_000);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(text.trim().replace(/\s+/g, " "));
    expect(splitInstagramText("corto")).toEqual(["corto"]);
  });

  it("envía cada parte a la cuenta con el token en la cabecera", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ recipient_id: "900111", message_id: "m_1" })));
    vi.stubGlobal("fetch", fetchMock);

    expect(await provider.sendText("900111", "Hola 👋")).toBe("m_1");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://graph.instagram.com/v25.0/17841400000000000/messages");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toEqual({ recipient: { id: "900111" }, message: { text: "Hola 👋" } });
    expect(new Headers(fetchMock.mock.calls[0][1]!.headers).get("authorization")).toBe("Bearer ig-token-de-prueba-largo");
  });

  it("descarga adjuntos sólo desde el CDN de Meta y arma el nombre del perfil", async () => {
    await expect(provider.downloadMedia("https://evil.example.com/a.jpg", 1_000)).rejects.toThrow("URL de adjunto inesperada");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "Ana Pérez", username: "anaperez" }))));
    expect(await provider.downloadMedia("https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1", 1_000)).toEqual({ data: Buffer.from([1, 2]), mimeType: "image/jpeg" });
    expect(await provider.profile("900111")).toBe("Ana Pérez (@anaperez)");
  });
});
