import { describe, expect, it, vi } from "vitest";
import { MediaTooLargeError } from "@/integrations/whatsapp/whatsapp-cloud-provider";
import { attachmentFromMedia, replyNeedsTextCopy, textForSpeech, transcribeVoiceNote } from "./whatsapp-media";

const downloader = (mimeType: string) => ({ downloadMedia: vi.fn().mockResolvedValue({ data: Buffer.from("hola"), mimeType }) });

describe("adjuntos de WhatsApp para el asistente", () => {
  it("convierte imágenes y PDF en bloques que el modelo puede ver", async () => {
    expect(await attachmentFromMedia(downloader("image/jpeg"), { kind: "image", id: "1" })).toEqual({ kind: "image", mediaType: "image/jpeg", data: Buffer.from("hola").toString("base64") });
    expect(await attachmentFromMedia(downloader("application/pdf"), { kind: "document", id: "2", mimeType: "application/pdf", filename: "planilla.pdf" }))
      .toEqual({ kind: "pdf", data: Buffer.from("hola").toString("base64"), filename: "planilla.pdf" });
  });

  it("avisa al modelo de lo que no puede abrir sin descargarlo", async () => {
    const excel = downloader("application/vnd.ms-excel");
    expect(await attachmentFromMedia(excel, { kind: "document", id: "3", mimeType: "application/vnd.ms-excel", filename: "ventas.xlsx" }))
      .toEqual({ kind: "unreadable", description: "documento \"ventas.xlsx\" (sólo puedes leer PDF e imágenes)" });
    expect(excel.downloadMedia).not.toHaveBeenCalled();
    const heavy = { downloadMedia: vi.fn().mockRejectedValue(new MediaTooLargeError(20_000_000, 10_000_000)) };
    expect(await attachmentFromMedia(heavy, { kind: "document", id: "4", mimeType: "application/pdf" })).toMatchObject({ kind: "unreadable" });
    expect(await attachmentFromMedia(excel, { kind: "audio", id: "5" })).toBeNull();
  });

  it("transcribe notas de voz sólo con proveedor de voz", async () => {
    const voice = { transcribe: vi.fn().mockResolvedValue({ text: "Necesito cotizar", costUsd: 0.001 }), synthesize: vi.fn() };
    expect(await transcribeVoiceNote(downloader("audio/ogg"), voice, { kind: "audio", id: "6", voice: true })).toEqual({ body: "[Nota de voz] Necesito cotizar", costUsd: 0.001 });
    expect(await transcribeVoiceNote(downloader("audio/ogg"), null, { kind: "audio", id: "6" })).toBeNull();
    voice.transcribe.mockRejectedValueOnce(new Error("caído"));
    expect(await transcribeVoiceNote(downloader("audio/ogg"), voice, { kind: "audio", id: "6" })).toBeNull();
  });

  it("decide cuándo la nota de voz va también por escrito y limpia el formato para la voz", () => {
    expect(replyNeedsTextCopy("Te dejo el enlace https://impulsialabs.cl")).toBe(true);
    expect(replyNeedsTextCopy("Parte desde $350.000 más IVA")).toBe(true);
    expect(replyNeedsTextCopy("¿Te acomoda el martes a las 10:30?")).toBe(true);
    expect(replyNeedsTextCopy("¡Buenísimo! Cuéntame un poco más de tu proceso.")).toBe(false);
    expect(textForSpeech("*Súper* 🙌\n- Primero revisamos\nMira https://impulsialabs.cl")).toBe("Súper \nPrimero revisamos\nMira el enlace que te dejo por escrito");
  });
});
