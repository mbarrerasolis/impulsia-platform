import "server-only";
import { getBrandConfig } from "@/lib/brand";
import { getServerEnv } from "@/lib/env";
import { ElevenLabsSpeech } from "./elevenlabs-speech";
import { OpenAiVoiceProvider, type VoiceProvider } from "./openai-audio";

/**
 * Proveedor de notas de voz; null si no hay OPENAI_API_KEY (los audios quedan sin transcribir).
 * OpenAI transcribe; la voz de las respuestas sale de ElevenLabs si está configurada (acento chileno real) o de OpenAI.
 */
export function createVoiceProvider(): VoiceProvider | null {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return null;
  const brand = getBrandConfig();
  const openAi = new OpenAiVoiceProvider({
    apiKey: env.OPENAI_API_KEY,
    transcribeModel: env.OPENAI_TRANSCRIBE_MODEL,
    speechModel: env.OPENAI_TTS_MODEL,
    voice: env.OPENAI_TTS_VOICE,
    vocabulary: `Conversación de WhatsApp en español de Chile con ${brand.name}. Palabras frecuentes: ${brand.name}, cotización, reunión, CRM, ERP, automatización, integración, inteligencia artificial, WhatsApp, RUT, factura.`,
    speechInstructions: [
      "Voz: mujer chilena de unos 35 años, ejecutiva comercial de Santiago, segura y amable.",
      "Acento: español de Chile, con la entonación y el ritmo de una santiaguina profesional; aspira suavemente la 's' final como en Chile, sin exagerar ni sonar caricaturesca. Nada de acento español, mexicano ni argentino.",
      "Tono: cálido, cercano y con energía positiva, como una nota de voz de WhatsApp a un cliente que te cae bien; sonríe al hablar.",
      "Ritmo: natural y conversado, con pausas breves entre ideas; nunca como locutora ni leyendo un guion.",
      "Pronunciación: montos en pesos chilenos y horarios dichos con claridad (por ejemplo, \"trescientos cincuenta mil pesos\", \"a las diez y media\").",
    ].join(" "),
  });
  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) return openAi;
  const elevenLabs = new ElevenLabsSpeech({ apiKey: env.ELEVENLABS_API_KEY, voiceId: env.ELEVENLABS_VOICE_ID, model: env.ELEVENLABS_MODEL });
  return {
    transcribe: (audio, mimeType) => openAi.transcribe(audio, mimeType),
    // Si ElevenLabs falla (cuota, voz retirada), la nota sale igual con la voz de OpenAI.
    synthesize: async (text) => {
      try {
        return await elevenLabs.synthesize(text);
      } catch (error) {
        console.error("voice.elevenlabs.failed", { message: error instanceof Error ? error.message : "unknown" });
        return openAi.synthesize(text);
      }
    },
  };
}
