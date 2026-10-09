import type { SpeechAudio } from "./openai-audio";

/** Costo aproximado por carácter en los planes de entrada de ElevenLabs (USD); sirve para el tope diario. */
const usdPerCharacter = 0.0002;

/**
 * Voz de ElevenLabs para las notas de voz: voces de la biblioteca con acento chileno real.
 * Devuelve OGG/Opus mono a 48 kHz, el formato que WhatsApp muestra como nota de voz.
 */
export class ElevenLabsSpeech {
  constructor(private readonly config: {
    apiKey: string;
    voiceId: string;
    model: string;
    /** 0–1: más bajo suena más expresivo y humano; más alto, más parejo. */
    stability?: number;
    style?: number;
  }) {}

  async synthesize(text: string): Promise<SpeechAudio> {
    if (!/^[A-Za-z0-9]{10,40}$/.test(this.config.voiceId)) throw new Error("ELEVENLABS_VOICE_ID inválido.");
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}?output_format=opus_48000_64`, {
      method: "POST",
      headers: { "xi-api-key": this.config.apiKey, "content-type": "application/json", accept: "audio/ogg" },
      body: JSON.stringify({
        text,
        model_id: this.config.model,
        language_code: "es",
        voice_settings: {
          stability: this.config.stability ?? 0.4,
          similarity_boost: 0.8,
          style: this.config.style ?? 0.25,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const raw = await response.json().catch(() => ({})) as { detail?: { message?: string } | string };
      const detail = typeof raw.detail === "string" ? raw.detail : raw.detail?.message;
      throw new Error(`ElevenLabs respondió ${response.status} al generar la voz: ${detail ?? "sin detalle"}`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    return { data, mimeType: "audio/ogg", costUsd: text.length * usdPerCharacter };
  }
}
