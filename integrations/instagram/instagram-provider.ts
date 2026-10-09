import { z } from "zod";
import { MediaTooLargeError, type DownloadedMedia } from "@/integrations/whatsapp/whatsapp-cloud-provider";

const sendResponseSchema = z.object({ message_id: z.string().min(1) }).passthrough();
const profileSchema = z.object({ name: z.string().optional(), username: z.string().optional() }).passthrough();

/** Instagram rechaza textos de más de 1000 bytes (UTF-8). */
const maxTextBytes = 1_000;
/** CDN de Meta donde Instagram deja los adjuntos que recibe la cuenta. */
const instagramMediaHosts = ["fbsbx.com", "cdninstagram.com", "fbcdn.net", "instagram.com", "facebook.com"];

/** Divide la respuesta en partes de hasta 1000 bytes, cortando por párrafos, frases y, en último caso, palabras. */
export function splitInstagramText(text: string, maxBytes = maxTextBytes): string[] {
  const bytes = (value: string) => Buffer.byteLength(value, "utf8");
  if (bytes(text) <= maxBytes) return [text];
  const parts: string[] = [];
  let current = "";
  const pieces = text.split(/(?<=\n)|(?<=[.!?…]\s)|(?<=\s)/);
  for (const piece of pieces) {
    if (bytes(current + piece) <= maxBytes) {
      current += piece;
      continue;
    }
    if (current.trim()) parts.push(current.trim());
    current = piece;
    while (bytes(current) > maxBytes) {
      let cut = current.length;
      while (bytes(current.slice(0, cut)) > maxBytes) cut -= 1;
      parts.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Envía y recibe mensajes directos con la API de Instagram (inicio de sesión de Instagram). */
export class InstagramMessagingProvider {
  constructor(private readonly config: { accessToken: string; accountId: string; graphVersion: string }) {}

  private async graph(path: string, init: { method: "GET" | "POST"; body?: unknown }) {
    const response = await fetch(`https://graph.instagram.com/${this.config.graphVersion}/${path}`, {
      method: init.method,
      headers: { authorization: `Bearer ${this.config.accessToken}`, "content-type": "application/json" },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await response.json().catch(() => ({})) as { error?: { message?: string } } & Record<string, unknown>;
    // Se devuelve el mensaje de Meta (nunca el token) para poder diagnosticar.
    if (!response.ok) throw new Error(`Instagram respondió ${response.status}: ${raw.error?.message ?? "sin detalle"}`);
    return raw;
  }

  /** Envía el texto (en varias partes si supera 1000 bytes) y devuelve el id del último mensaje. */
  async sendText(to: string, body: string) {
    let lastId = "";
    for (const part of splitInstagramText(body)) {
      const raw = await this.graph(`${this.config.accountId}/messages`, { method: "POST", body: { recipient: { id: to }, message: { text: part } } });
      lastId = sendResponseSchema.parse(raw).message_id;
    }
    return lastId;
  }

  /** Descarga un adjunto recibido; en Instagram el "id" es la URL temporal del CDN de Meta (no lleva token). */
  async downloadMedia(url: string, maxBytes: number): Promise<DownloadedMedia> {
    const host = new URL(url).hostname;
    if (new URL(url).protocol !== "https:" || !instagramMediaHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
      throw new Error("Instagram entregó una URL de adjunto inesperada.");
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Instagram respondió ${response.status} al descargar el adjunto.`);
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > maxBytes) throw new MediaTooLargeError(declared, maxBytes);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength > maxBytes) throw new MediaTooLargeError(data.byteLength, maxBytes);
    const mimeType = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim().toLowerCase();
    return { data, mimeType };
  }

  /** Nombre y usuario del remitente (requiere que haya escrito a la cuenta); null si Meta no lo entrega. */
  async profile(igsid: string) {
    if (!/^\d+$/.test(igsid)) return null;
    try {
      const parsed = profileSchema.parse(await this.graph(`${igsid}?fields=name,username`, { method: "GET" }));
      const label = parsed.name && parsed.username ? `${parsed.name} (@${parsed.username})` : parsed.name ?? (parsed.username ? `@${parsed.username}` : undefined);
      return label ?? null;
    } catch (error) {
      console.warn("instagram.profile.failed", { message: error instanceof Error ? error.message : "unknown" });
      return null;
    }
  }
}
