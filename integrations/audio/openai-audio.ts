import { z } from "zod";

/** Tarifas públicas aproximadas (USD): transcripción por minuto de audio y voz por minuto generado. */
const transcribeUsdPerMinute = 0.003;
const speechUsdPerMinute = 0.015;
/** Una nota de voz de WhatsApp (Opus mono) pesa cerca de 2 KB por segundo. */
const voiceNoteBytesPerSecond = 2_000;
/** Ritmo de habla aproximado para estimar la duración de la voz generada. */
const spokenCharsPerSecond = 15;

const transcriptionSchema = z.object({
  text: z.string(),
  usage: z.object({ type: z.literal("duration"), seconds: z.number().nonnegative() }).passthrough().optional().catch(undefined),
}).passthrough();

export interface AudioTranscription {
  text: string;
  costUsd: number;
}

export interface SpeechAudio {
  /** OGG/Opus mono, el formato que WhatsApp muestra como nota de voz. */
  data: Buffer;
  mimeType: "audio/ogg";
  costUsd: number;
}

/** Lo que el asistente necesita para entender y producir notas de voz; permite un doble en pruebas. */
export interface VoiceProvider {
  transcribe(audio: Buffer, mimeType: string): Promise<AudioTranscription>;
  synthesize(text: string): Promise<SpeechAudio>;
}

const extensionByMime: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/amr": "amr",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

export class OpenAiVoiceProvider implements VoiceProvider {
  constructor(private readonly config: {
    apiKey: string;
    transcribeModel: string;
    speechModel: string;
    voice: string;
    /** Nombres propios que el modelo debe escribir bien (marca, asistente, productos). */
    vocabulary?: string;
    /** Cómo debe sonar la voz generada. */
    speechInstructions?: string;
  }) {}

  async transcribe(audio: Buffer, mimeType: string): Promise<AudioTranscription> {
    const extension = extensionByMime[mimeType] ?? "ogg";
    const form = new FormData();
    form.append("model", this.config.transcribeModel);
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), `nota-de-voz.${extension}`);
    form.append("response_format", "json");
    if (this.config.vocabulary) form.append("prompt", this.config.vocabulary);
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${this.config.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const raw = await response.json().catch(() => ({})) as { error?: { message?: string } };
    if (!response.ok) throw new Error(`OpenAI respondió ${response.status} al transcribir: ${raw.error?.message ?? "sin detalle"}`);
    const parsed = transcriptionSchema.parse(raw);
    const seconds = parsed.usage?.seconds ?? audio.byteLength / voiceNoteBytesPerSecond;
    return { text: parsed.text.trim(), costUsd: (seconds / 60) * transcribeUsdPerMinute };
  }

  async synthesize(text: string): Promise<SpeechAudio> {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { authorization: `Bearer ${this.config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.config.speechModel,
        voice: this.config.voice,
        input: text,
        response_format: "opus",
        ...(this.config.speechInstructions ? { instructions: this.config.speechInstructions } : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const raw = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`OpenAI respondió ${response.status} al generar la voz: ${raw.error?.message ?? "sin detalle"}`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    return { data, mimeType: "audio/ogg", costUsd: (text.length / spokenCharsPerSecond / 60) * speechUsdPerMinute };
  }
}
