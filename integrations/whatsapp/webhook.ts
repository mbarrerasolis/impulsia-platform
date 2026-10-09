import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const mediaSchema = z.object({
  id: z.string().min(1),
  mime_type: z.string().optional(),
  caption: z.string().optional(),
  filename: z.string().optional(),
  voice: z.boolean().optional(),
}).passthrough();

const inboundMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string().min(1),
  text: z.object({ body: z.string() }).optional(),
  button: z.object({ text: z.string() }).optional(),
  image: mediaSchema.optional(),
  document: mediaSchema.optional(),
  audio: mediaSchema.optional(),
  video: mediaSchema.optional(),
  sticker: mediaSchema.optional(),
  interactive: z.object({
    button_reply: z.object({ title: z.string() }).optional(),
    list_reply: z.object({ title: z.string() }).optional(),
  }).optional(),
}).passthrough();

const deliveryStatusSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  timestamp: z.string().regex(/^\d+$/),
  recipient_id: z.string().min(1).optional(),
  errors: z.array(z.unknown()).optional(),
}).passthrough();

const valueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  metadata: z.object({ phone_number_id: z.string().min(1) }),
  contacts: z.array(z.object({
    wa_id: z.string().min(1),
    profile: z.object({ name: z.string().min(1) }).optional(),
  })).optional(),
  messages: z.array(inboundMessageSchema).optional(),
  statuses: z.array(deliveryStatusSchema).optional(),
}).passthrough();

const payloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    changes: z.array(z.object({ field: z.string(), value: valueSchema })),
  })),
});

/** Origen que Meta adjunta al primer mensaje cuando la persona escribe desde un anuncio o publicación (Click-to-WhatsApp). */
export const whatsAppReferralSchema = z.object({
  source_url: z.string().optional(),
  source_id: z.string().optional(),
  source_type: z.string().optional(),
  headline: z.string().optional(),
  body: z.string().optional(),
  ctwa_clid: z.string().optional(),
}).passthrough();

export type WhatsAppReferral = z.infer<typeof whatsAppReferralSchema>;

export type WhatsAppMediaKind = "image" | "document" | "audio" | "video" | "sticker";

/** Archivo adjunto: Meta sólo manda el id; el contenido se descarga aparte con el token. */
export interface WhatsAppMedia {
  kind: WhatsAppMediaKind;
  id: string;
  mimeType?: string;
  caption?: string;
  filename?: string;
  /** true si es una nota de voz grabada en WhatsApp (no un archivo de audio reenviado). */
  voice?: boolean;
}

export interface InboundWhatsAppMessage {
  externalId: string;
  phoneNumberId: string;
  sender: string;
  profileName?: string;
  body: string;
  type: string;
  sentAt: string;
  referral?: WhatsAppReferral;
  media?: WhatsAppMedia;
  raw: Record<string, unknown>;
}

export interface WhatsAppDeliveryError {
  code?: number;
  title?: string;
  details?: string;
}

export interface WhatsAppDeliveryStatus {
  externalId: string;
  status: string;
  occurredAt: string;
  recipient?: string;
  failed: boolean;
  /** Motivo que informa Meta cuando el envío falla (p. ej. 131042: falta método de pago). */
  error?: WhatsAppDeliveryError;
  raw: Record<string, unknown>;
}

export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const received = signatureHeader.slice("sha256=".length);
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

const mediaKinds: WhatsAppMediaKind[] = ["image", "document", "audio", "video", "sticker"];

function messageMedia(message: z.infer<typeof inboundMessageSchema>): WhatsAppMedia | undefined {
  const kind = mediaKinds.find((candidate) => candidate === message.type && message[candidate]);
  const media = kind ? message[kind] : undefined;
  if (!kind || !media) return undefined;
  return {
    kind,
    id: media.id,
    ...(media.mime_type ? { mimeType: media.mime_type } : {}),
    ...(media.caption?.trim() ? { caption: media.caption.trim() } : {}),
    ...(media.filename ? { filename: media.filename } : {}),
    ...(media.voice !== undefined ? { voice: media.voice } : {}),
  };
}

const storedMediaSchema = z.object({
  kind: z.enum(["image", "document", "audio", "video", "sticker"]),
  id: z.string().min(1),
  mimeType: z.string().optional(),
  caption: z.string().optional(),
  filename: z.string().optional(),
  voice: z.boolean().optional(),
});

/** Recupera el adjunto desde el mensaje crudo guardado en `messages.metadata`. */
export function mediaFromStoredMessage(raw: unknown): WhatsAppMedia | undefined {
  // Otros canales (Instagram) guardan el adjunto ya normalizado en `media`.
  const normalized = storedMediaSchema.safeParse((raw as { media?: unknown } | null)?.media);
  if (normalized.success) return normalized.data;
  const parsed = inboundMessageSchema.safeParse(raw);
  return parsed.success ? messageMedia(parsed.data) : undefined;
}

/** Texto que se guarda para un adjunto mientras no haya transcripción; el modelo y el panel lo leen así. */
export function mediaPlaceholder(media: WhatsAppMedia) {
  const caption = media.caption ? ` ${media.caption}` : "";
  switch (media.kind) {
    case "image": return `[Imagen]${caption}`;
    case "document": return `[Documento${media.filename ? `: ${media.filename}` : ""}]${caption}`;
    case "audio": return `[Nota de voz sin transcribir]`;
    case "video": return `[Video]${caption}`;
    case "sticker": return "[Sticker]";
  }
}

function messageBody(message: z.infer<typeof inboundMessageSchema>, media: WhatsAppMedia | undefined) {
  if (media) return mediaPlaceholder(media);
  return message.text?.body
    ?? message.button?.text
    ?? message.interactive?.button_reply?.title
    ?? message.interactive?.list_reply?.title
    ?? `[Mensaje ${message.type}]`;
}

export function extractInboundWhatsAppMessages(payload: unknown): InboundWhatsAppMessage[] {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return [];
  const result: InboundWhatsAppMessage[] = [];

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const contacts = new Map((change.value.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name]));
      for (const message of change.value.messages ?? []) {
        const referral = whatsAppReferralSchema.safeParse(message.referral);
        const media = messageMedia(message);
        result.push({
          ...(referral.success ? { referral: referral.data } : {}),
          ...(media ? { media } : {}),
          externalId: message.id,
          phoneNumberId: change.value.metadata.phone_number_id,
          sender: message.from,
          profileName: contacts.get(message.from),
          body: messageBody(message, media),
          type: message.type,
          sentAt: new Date(Number(message.timestamp) * 1_000).toISOString(),
          raw: message,
        });
      }
    }
  }
  return result;
}

export function extractWhatsAppDeliveryStatuses(payload: unknown): WhatsAppDeliveryStatus[] {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return [];
  const result: WhatsAppDeliveryStatus[] = [];

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      for (const status of change.value.statuses ?? []) {
        result.push({
          externalId: status.id,
          status: status.status,
          occurredAt: new Date(Number(status.timestamp) * 1_000).toISOString(),
          recipient: status.recipient_id,
          failed: status.status === "failed",
          ...(status.status === "failed" ? { error: deliveryError(status.errors) } : {}),
          raw: status,
        });
      }
    }
  }
  return result;
}

const deliveryErrorSchema = z.object({
  code: z.number().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  error_data: z.object({ details: z.string().optional() }).optional(),
}).passthrough();

function deliveryError(errors: unknown[] | undefined): WhatsAppDeliveryError {
  const parsed = deliveryErrorSchema.safeParse(errors?.[0]);
  if (!parsed.success) return {};
  const { code, title, message, error_data } = parsed.data;
  const summary = title ?? message;
  return {
    ...(code !== undefined ? { code } : {}),
    ...(summary ? { title: summary.slice(0, 200) } : {}),
    ...(error_data?.details ? { details: error_data.details.slice(0, 500) } : {}),
  };
}

const deliveryErrorHints: Record<number, string> = {
  131042: "falta un método de pago válido en WhatsApp Manager",
  131047: "pasaron más de 24 h desde el último mensaje del cliente; sólo se puede escribir con una plantilla",
  131026: "el número no puede recibir el mensaje (no usa WhatsApp o tiene una versión antigua)",
  130497: "Meta no permite enviar mensajes a este país desde esta cuenta",
  131049: "Meta retuvo el mensaje para cuidar la experiencia del usuario",
  131056: "demasiados mensajes seguidos al mismo número",
  131031: "la cuenta de WhatsApp Business está restringida o bloqueada",
};

/** Motivo legible para el panel a partir de lo que guardó el webhook en `messages.metadata`. */
export function describeDeliveryError(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object" || !("deliveryError" in metadata)) return undefined;
  const error = (metadata as { deliveryError?: WhatsAppDeliveryError }).deliveryError ?? {};
  const hint = error.code !== undefined ? deliveryErrorHints[error.code] : undefined;
  const reason = hint ?? error.details ?? error.title ?? "Meta no informó el motivo";
  return error.code !== undefined ? `Error ${error.code}: ${reason}` : reason;
}
