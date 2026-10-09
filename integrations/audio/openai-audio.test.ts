import { afterEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsSpeech } from "./elevenlabs-speech";
import { OpenAiVoiceProvider } from "./openai-audio";

const provider = new OpenAiVoiceProvider({ apiKey: "sk-test-clave-larga-1234", transcribeModel: "gpt-4o-mini-transcribe", speechModel: "gpt-4o-mini-tts", voice: "coral", vocabulary: "ImpulsIA" });

afterEach(() => vi.unstubAllGlobals());

describe("OpenAiVoiceProvider", () => {
  it("transcribe una nota de voz y estima el costo por duración", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ text: " Hola, quiero cotizar. ", usage: { type: "duration", seconds: 60 } })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.transcribe(Buffer.from([1, 2, 3]), "audio/ogg");

    expect(result.text).toBe("Hola, quiero cotizar.");
    expect(result.costUsd).toBeCloseTo(0.003);
    const form = fetchMock.mock.calls[0][1]!.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-mini-transcribe");
    expect(form.get("prompt")).toBe("ImpulsIA");
    expect((form.get("file") as File).name).toBe("nota-de-voz.ogg");
  });

  it("genera voz en OGG/Opus para WhatsApp", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([79, 103, 103, 83])));
    vi.stubGlobal("fetch", fetchMock);

    const audio = await provider.synthesize("Te propongo el martes a las 10.");

    expect(audio.mimeType).toBe("audio/ogg");
    expect(audio.data.byteLength).toBe(4);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toMatchObject({ model: "gpt-4o-mini-tts", voice: "coral", response_format: "opus" });
  });

  it("muestra el error de OpenAI sin la clave", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Invalid file format." } }), { status: 400 })));
    const failure = await provider.transcribe(Buffer.from([1]), "audio/ogg").catch((error: Error) => error.message);
    expect(failure).toBe("OpenAI respondió 400 al transcribir: Invalid file format.");
    expect(failure).not.toContain("sk-test");
  });
});

describe("ElevenLabsSpeech", () => {
  const speech = new ElevenLabsSpeech({ apiKey: "el-test-clave-larga-1234", voiceId: "ClNifCEVq1smkl4M3aTk", model: "eleven_multilingual_v2" });

  it("pide OGG/Opus en español con la voz elegida", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([79, 103, 103, 83])));
    vi.stubGlobal("fetch", fetchMock);

    const audio = await speech.synthesize("Hola, ¿cómo estái?");

    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.elevenlabs.io/v1/text-to-speech/ClNifCEVq1smkl4M3aTk?output_format=opus_48000_64");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toMatchObject({ model_id: "eleven_multilingual_v2", language_code: "es" });
    expect(audio).toMatchObject({ mimeType: "audio/ogg" });
  });

  it("muestra el error de ElevenLabs sin la clave", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ detail: { message: "quota exceeded" } }), { status: 401 })));
    const failure = await speech.synthesize("Hola").catch((error: Error) => error.message);
    expect(failure).toBe("ElevenLabs respondió 401 al generar la voz: quota exceeded");
    expect(failure).not.toContain("el-test");
  });
});
