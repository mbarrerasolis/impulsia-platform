import { z } from "zod";

const sendResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

const mediaInfoSchema = z.object({
  url: z.url(),
  mime_type: z.string().min(1),
  file_size: z.coerce.number().int().nonnegative().optional(),
});

const metaMediaHosts = ["fbsbx.com", "facebook.com", "whatsapp.net", "fbcdn.net"];

const uploadResponseSchema = z.object({ id: z.string().min(1) });

export interface DownloadedMedia {
  data: Buffer;
  mimeType: string;
}

export class WhatsAppCloudProvider {
  constructor(private readonly config: {
    accessToken: string;
    phoneNumberId: string;
    graphVersion: string;
  }) {}

  async sendText(to: string, body: string) {
    return this.sendMessage({ to, type: "text", text: { body } });
  }

  /** Envía un audio ya subido; con `voice` se muestra como nota de voz (requiere OGG/Opus mono). */
  async sendAudio(to: string, mediaId: string, voice = true) {
    return this.sendMessage({ to, type: "audio", audio: { id: mediaId, voice } });
  }

  private async sendMessage(message: Record<string, unknown>) {
    const response = await fetch(
      `https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...message }),
      },
    );
    const raw = await response.json();
    if (!response.ok) throw new Error(`WhatsApp Cloud API respondió ${response.status}.`);
    return sendResponseSchema.parse(raw).messages[0].id;
  }

  /**
   * Descarga un adjunto recibido: primero se pide la URL temporal del id y luego el archivo, ambos con el token.
   * Rechaza archivos sobre `maxBytes` antes de bajarlos enteros.
   */
  async downloadMedia(mediaId: string, maxBytes: number): Promise<DownloadedMedia> {
    if (!/^\d+$/.test(mediaId)) throw new Error("Id de archivo de WhatsApp inválido.");
    const info = mediaInfoSchema.parse(await this.graph(mediaId, { method: "GET" }));
    if (info.file_size !== undefined && info.file_size > maxBytes) throw new MediaTooLargeError(info.file_size, maxBytes);
    // El token sólo viaja a dominios de Meta, aunque la respuesta trajera otra URL.
    const host = new URL(info.url).hostname;
    if (!metaMediaHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) throw new Error("Meta entregó una URL de descarga inesperada.");
    const response = await fetch(info.url, {
      headers: { authorization: `Bearer ${this.config.accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Meta respondió ${response.status} al descargar el archivo.`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.byteLength > maxBytes) throw new MediaTooLargeError(data.byteLength, maxBytes);
    return { data, mimeType: info.mime_type.split(";")[0].trim().toLowerCase() };
  }

  /** Sube un archivo a WhatsApp y devuelve su id para enviarlo (vigente 30 días). */
  async uploadMedia(data: Buffer, mimeType: string, filename: string) {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimeType);
    form.append("file", new Blob([new Uint8Array(data)], { type: mimeType }), filename);
    const response = await fetch(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneNumberId}/media`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.config.accessToken}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (!response.ok) throw new Error(`Meta respondió ${response.status} al subir el archivo: ${raw.error?.message ?? "sin detalle"}`);
    return uploadResponseSchema.parse(raw).id;
  }

  private async graph(path: string, init: { method: "GET" | "POST"; body?: unknown }) {
    const response = await fetch(`https://graph.facebook.com/${this.config.graphVersion}/${path}`, {
      method: init.method,
      headers: { authorization: `Bearer ${this.config.accessToken}`, "content-type": "application/json" },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await response.json().catch(() => ({})) as { error?: { message?: string; code?: number } } & Record<string, unknown>;
    // Se devuelve el mensaje de Meta (nunca el token) para poder diagnosticar desde el panel.
    if (!response.ok) throw new Error(`Meta respondió ${response.status}: ${raw.error?.message ?? "sin detalle"}`);
    return raw;
  }

  /** Estado del número en la plataforma (verificación, nombre visible, calidad). */
  async phoneNumberStatus() {
    return this.graph(`${this.config.phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status,name_status,status,quality_rating,platform_type`, { method: "GET" });
  }

  /** Activa el número en la API de la nube; `pin` es el PIN de verificación en dos pasos (6 dígitos) que elige el dueño. */
  async registerPhoneNumber(pin: string) {
    if (!/^\d{6}$/.test(pin)) throw new Error("El PIN debe tener 6 dígitos.");
    return this.graph(`${this.config.phoneNumberId}/register`, { method: "POST", body: { messaging_product: "whatsapp", pin } });
  }

  /** Suscribe la cuenta de WhatsApp Business a la app para que Meta entregue los mensajes al webhook. */
  async subscribeBusinessAccount(businessAccountId: string) {
    return this.graph(`${businessAccountId}/subscribed_apps`, { method: "POST" });
  }
}

export class MediaTooLargeError extends Error {
  constructor(readonly bytes: number, readonly maxBytes: number) {
    super(`El archivo pesa ${Math.round(bytes / 1_000_000)} MB y el máximo es ${Math.round(maxBytes / 1_000_000)} MB.`);
  }
}
