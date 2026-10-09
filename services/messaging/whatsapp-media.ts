import type { VoiceProvider } from "@/integrations/audio/openai-audio";
import type { WhatsAppMedia } from "@/integrations/whatsapp/webhook";
import { MediaTooLargeError, type DownloadedMedia } from "@/integrations/whatsapp/whatsapp-cloud-provider";
import type { AssistantAttachment } from "./sales-assistant";

/** Topes por archivo: la API de Claude admite imágenes de hasta 5 MB en base64 (≈3,75 MB reales). */
export const mediaLimits = {
  imageBytes: 3_750_000,
  pdfBytes: 10_000_000,
  /** WhatsApp admite audios de hasta 16 MB. */
  audioBytes: 16_000_000,
  /** Adjuntos que ve el modelo por respuesta (los más recientes). */
  attachmentsPerTurn: 4,
} as const;

const claudeImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ClaudeImageType = (typeof claudeImageTypes)[number];

export interface MediaDownloader {
  downloadMedia(mediaId: string, maxBytes: number): Promise<DownloadedMedia>;
}

export const transcribedVoicePrefix = "[Nota de voz]";

/** Texto que se guarda para una nota de voz transcrita; el modelo y el panel la leen así. */
export function transcribedVoiceBody(text: string) {
  return text ? `${transcribedVoicePrefix} ${text}` : `${transcribedVoicePrefix} (sin palabras reconocibles)`;
}

/** Baja una nota de voz y la transcribe; null si no hay proveedor de voz o falla (queda el texto provisional). */
export async function transcribeVoiceNote(downloader: MediaDownloader, voice: VoiceProvider | null | undefined, media: WhatsAppMedia) {
  if (!voice || media.kind !== "audio") return null;
  try {
    const file = await downloader.downloadMedia(media.id, mediaLimits.audioBytes);
    const transcription = await voice.transcribe(file.data, file.mimeType);
    return { body: transcribedVoiceBody(transcription.text), costUsd: transcription.costUsd };
  } catch (error) {
    console.error("whatsapp.voice.transcribe_failed", { message: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}

/** Convierte un adjunto de WhatsApp en algo que el modelo pueda ver; los formatos que no lee se le informan como texto. */
export async function attachmentFromMedia(downloader: MediaDownloader, media: WhatsAppMedia): Promise<AssistantAttachment | null> {
  const name = media.filename ? ` "${media.filename.slice(0, 120)}"` : "";
  if (media.kind === "image") {
    try {
      const file = await downloader.downloadMedia(media.id, mediaLimits.imageBytes);
      if (!claudeImageTypes.includes(file.mimeType as ClaudeImageType)) return { kind: "unreadable", description: `imagen en formato ${file.mimeType}` };
      return { kind: "image", mediaType: file.mimeType as ClaudeImageType, data: file.data.toString("base64") };
    } catch (error) {
      return unreadable(error, "imagen");
    }
  }
  if (media.kind === "document") {
    const isPdf = media.mimeType === "application/pdf" || media.filename?.toLowerCase().endsWith(".pdf");
    if (!isPdf) return { kind: "unreadable", description: `documento${name} (sólo puedes leer PDF e imágenes)` };
    try {
      const file = await downloader.downloadMedia(media.id, mediaLimits.pdfBytes);
      return { kind: "pdf", data: file.data.toString("base64"), ...(media.filename ? { filename: media.filename } : {}) };
    } catch (error) {
      return unreadable(error, `PDF${name}`);
    }
  }
  if (media.kind === "video") return { kind: "unreadable", description: "video (no puedes ver videos)" };
  return null;
}

function unreadable(error: unknown, what: string): AssistantAttachment {
  if (error instanceof MediaTooLargeError) return { kind: "unreadable", description: `${what} demasiado pesado (${error.message})` };
  console.error("whatsapp.media.download_failed", { message: error instanceof Error ? error.message : "unknown" });
  return { kind: "unreadable", description: `${what} que no se pudo descargar` };
}

/** Datos que conviene tener por escrito aunque la respuesta vaya en audio: enlaces, correos, montos, horarios o cifras. */
export function replyNeedsTextCopy(reply: string) {
  return /https?:\/\/|www\.|\S+@\S+\.\S+|\$\s?\d|\d{1,2}:\d{2}|\d{3,}/i.test(reply);
}

/** Limpia el formato de WhatsApp para que la voz no lea asteriscos ni viñetas. */
export function textForSpeech(reply: string) {
  return reply
    .replace(/[*_~`]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/https?:\/\/\S+/g, "el enlace que te dejo por escrito")
    .replace(/[\p{Extended_Pictographic}️]/gu, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
