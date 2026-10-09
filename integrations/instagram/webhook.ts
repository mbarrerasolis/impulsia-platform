import { z } from "zod";
import { mediaPlaceholder, type InboundWhatsAppMessage, type WhatsAppMedia } from "@/integrations/whatsapp/webhook";

const attachmentSchema = z.object({
  type: z.string(),
  payload: z.object({ url: z.string().optional(), title: z.string().optional() }).passthrough().optional(),
}).passthrough();

const messagingSchema = z.object({
  sender: z.object({ id: z.string().min(1) }),
  recipient: z.object({ id: z.string().min(1) }),
  timestamp: z.number(),
  message: z.object({
    mid: z.string().min(1),
    text: z.string().optional(),
    attachments: z.array(attachmentSchema).optional(),
    is_echo: z.boolean().optional(),
    is_deleted: z.boolean().optional(),
    is_unsupported: z.boolean().optional(),
    quick_reply: z.object({ payload: z.string() }).optional(),
  }).passthrough().optional(),
}).passthrough();

const payloadSchema = z.object({
  object: z.literal("instagram"),
  entry: z.array(z.object({
    id: z.string().optional(),
    messaging: z.array(z.unknown()).optional(),
  }).passthrough()),
});

/** Tipos de adjunto de Instagram que el asistente puede revisar (la URL es pública y temporal). */
const mediaKindByType: Record<string, WhatsAppMedia["kind"]> = {
  image: "image",
  audio: "audio",
  video: "video",
  file: "document",
  ig_reel: "video",
  reel: "video",
};

const sharedPlaceholders: Record<string, string> = {
  share: "[Publicación compartida]",
  story_mention: "[Te mencionó en una historia]",
  ig_post: "[Publicación compartida]",
  animated_image_share: "[GIF]",
};

function attachmentMedia(attachment: z.infer<typeof attachmentSchema>): WhatsAppMedia | undefined {
  const kind = mediaKindByType[attachment.type];
  const url = attachment.payload?.url;
  if (!kind || !url?.startsWith("https://")) return undefined;
  return { kind, id: url, ...(kind === "audio" ? { voice: true } : {}), ...(attachment.payload?.title ? { filename: attachment.payload.title } : {}) };
}

/**
 * Normaliza los mensajes directos al formato del procesador de WhatsApp: el remitente es el IGSID (no un teléfono) y
 * el adjunto viaja como URL. El adjunto normalizado se guarda en `raw.media` para recuperarlo desde `messages.metadata`.
 * Ignora ecos (mensajes que envía la propia cuenta), borrados, reacciones y lecturas.
 */
export function extractInboundInstagramMessages(payload: unknown): InboundWhatsAppMessage[] {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return [];
  const result: InboundWhatsAppMessage[] = [];
  for (const entry of parsed.data.entry) {
    for (const item of entry.messaging ?? []) {
      const event = messagingSchema.safeParse(item);
      if (!event.success || !event.data.message) continue;
      const { message, sender, recipient, timestamp } = event.data;
      if (message.is_echo || message.is_deleted) continue;
      const attachment = message.attachments?.[0];
      const media = attachment ? attachmentMedia(attachment) : undefined;
      const text = message.text?.trim();
      const shared = attachment && !media ? sharedPlaceholders[attachment.type] ?? `[Adjunto ${attachment.type}]` : undefined;
      const body = media
        ? `${mediaPlaceholder(media)}${text ? ` ${text}` : ""}`
        : text || shared || (message.is_unsupported ? "[Mensaje que Instagram no permite leer]" : "[Mensaje sin texto]");
      result.push({
        externalId: message.mid,
        phoneNumberId: recipient.id,
        sender: sender.id,
        body,
        type: media?.kind ?? (text ? "text" : attachment?.type ?? "unknown"),
        sentAt: new Date(timestamp).toISOString(),
        ...(media ? { media } : {}),
        raw: { ...(item as Record<string, unknown>), ...(media ? { media } : {}) },
      });
    }
  }
  return result;
}
