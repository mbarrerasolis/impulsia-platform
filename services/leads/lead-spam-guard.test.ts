import { describe, expect, it } from "vitest";
import { detectBotSubmission, splitLeadSubmission } from "./lead-spam-guard";

describe("lead-spam-guard", () => {
  it("separa las señales anti-bot del payload del lead", () => {
    const { signals, input } = splitLeadSubmission({ name: "Ana", website: "", elapsedMs: 12_000, captchaToken: "tok" });
    expect(input).toEqual({ name: "Ana" });
    expect(signals).toEqual({ honeypot: "", elapsedMs: 12_000, captchaToken: "tok" });
  });

  it("detecta el campo trampa lleno y el envío demasiado rápido", () => {
    expect(detectBotSubmission({ honeypot: "https://spam.example" , elapsedMs: 20_000 })).toBe("honeypot");
    expect(detectBotSubmission({ honeypot: "", elapsedMs: 800 })).toBe("too_fast");
    expect(detectBotSubmission({ honeypot: "", elapsedMs: 15_000 })).toBeUndefined();
  });

  it("no descarta un envío sin tiempo medido (pestaña anterior al despliegue)", () => {
    expect(detectBotSubmission(splitLeadSubmission({ name: "Ana" }).signals)).toBeUndefined();
  });

  it("tolera payloads que no son objetos para que los rechace la validación", () => {
    expect(splitLeadSubmission(null).input).toBeNull();
    expect(splitLeadSubmission([1]).input).toEqual([1]);
  });
});
