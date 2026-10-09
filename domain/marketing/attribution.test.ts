import { describe, expect, it } from "vitest";
import { attributionFromLanding, attributionFromRefCode, attributionFromWhatsAppReferral, attributionLabel, attributionRefCode, parseLeadAttribution } from "./attribution";

const now = new Date("2026-09-25T15:00:00.000Z");

describe("attributionFromLanding", () => {
  it("toma los UTM del enlace de la bio de Instagram", () => {
    const url = new URL("https://impulsialabs.cl/diagnostico?utm_source=Instagram&utm_medium=bio&utm_campaign=lanzamiento");
    expect(attributionFromLanding(url, "https://l.instagram.com/", now)).toEqual({
      utmSource: "instagram", utmMedium: "bio", utmCampaign: "lanzamiento",
      referrer: "l.instagram.com", landingPath: "/diagnostico", capturedAt: now.toISOString(),
    });
  });

  it("registra el clic de un anuncio de Meta aunque no traiga UTM", () => {
    const value = attributionFromLanding(new URL("https://impulsialabs.cl/?fbclid=IwAR123"), undefined, now);
    expect(value?.fbclid).toBe("IwAR123");
    expect(attributionLabel(value)).toBe("Anuncio de Meta");
  });

  it("ignora la navegación interna y el tráfico directo", () => {
    expect(attributionFromLanding(new URL("https://impulsialabs.cl/diagnostico"), "https://www.impulsialabs.cl/", now)).toBeUndefined();
    expect(attributionFromLanding(new URL("https://impulsialabs.cl/"), undefined, now)).toBeUndefined();
  });

  it("usa el dominio de referencia cuando no hay UTM", () => {
    expect(attributionLabel(attributionFromLanding(new URL("https://impulsialabs.cl/"), "https://www.linkedin.com/feed/", now))).toBe("LinkedIn");
  });
});

describe("parseLeadAttribution", () => {
  it("descarta valores inválidos o vacíos sin lanzar error", () => {
    expect(parseLeadAttribution("instagram")).toBeUndefined();
    expect(parseLeadAttribution({ landingPath: "/" })).toBeUndefined();
    expect(parseLeadAttribution({ utmSource: "x".repeat(500) })).toBeUndefined();
  });
});

describe("attributionLabel", () => {
  it("resume fuente, medio y campaña para el CRM", () => {
    expect(attributionLabel({ utmSource: "ig", utmMedium: "reel", utmCampaign: "agenda-medica" })).toBe("Instagram · reel · agenda-medica");
    expect(attributionLabel(undefined)).toBe("Directo o sin datos");
  });
});

describe("attributionFromWhatsAppReferral", () => {
  const at = "2026-10-06T14:00:00.000Z";

  it("marca como pagado el anuncio de Instagram con su título e id", () => {
    expect(attributionFromWhatsAppReferral({
      source_url: "https://www.instagram.com/p/abc", source_id: "120210000", source_type: "ad", headline: "Que ningún cliente se quede sin respuesta",
    }, at)).toEqual({
      utmSource: "instagram", utmMedium: "paid", utmCampaign: "Que ningún cliente se quede sin respuesta", utmContent: "120210000",
      referrer: "instagram.com", landingPath: "whatsapp", capturedAt: at,
    });
  });

  it("reconoce Facebook por fb.me y trata las publicaciones como orgánicas", () => {
    expect(attributionFromWhatsAppReferral({ source_url: "https://fb.me/xyz", source_id: "99", source_type: "post" }, at))
      .toEqual(expect.objectContaining({ utmSource: "facebook", utmMedium: "organic" }));
  });

  it("sin URL conocida usa meta, y sin datos no atribuye", () => {
    expect(attributionFromWhatsAppReferral({ ctwa_clid: "clid", source_type: "ad" }, at)).toEqual(expect.objectContaining({ utmSource: "meta", utmMedium: "paid" }));
    expect(attributionFromWhatsAppReferral({}, at)).toBeUndefined();
    expect(attributionFromWhatsAppReferral(undefined, at)).toBeUndefined();
  });
});

describe("código de referencia para WhatsApp", () => {
  const at = "2026-10-07T15:00:00.000Z";

  it("ida y vuelta: la procedencia de la visita llega a la conversación", () => {
    const code = attributionRefCode({ utmSource: "email", utmMedium: "outbound", utmCampaign: "Comida Piloto", utmContent: "A-017" });
    expect(code).toBe("[ref: email.outbound.comida-piloto.a-017]");
    expect(attributionFromRefCode(`Hola, vengo de la demostración para Burger X. ${code}`, at)).toEqual({
      utmSource: "email", utmMedium: "outbound", utmCampaign: "comida-piloto", utmContent: "a-017", landingPath: "whatsapp", capturedAt: at,
    });
  });

  it("acepta partes vacías y no inventa origen sin código", () => {
    expect(attributionRefCode({ utmSource: "instagram" })).toBe("[ref: instagram...]");
    expect(attributionFromRefCode("hola [ref: instagram...]", at)).toEqual(expect.objectContaining({ utmSource: "instagram", utmCampaign: undefined }));
    expect(attributionRefCode(undefined)).toBeUndefined();
    expect(attributionFromRefCode("hola, quiero info", at)).toBeUndefined();
    expect(attributionFromRefCode(null, at)).toBeUndefined();
  });
});
