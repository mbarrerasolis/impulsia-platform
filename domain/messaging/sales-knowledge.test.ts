import { describe, expect, it } from "vitest";
import salesKnowledge from "@/config/sales-knowledge.json";
import { defaultSolutionCatalog } from "@/domain/config/edition";
import { currentPricingRules } from "@/domain/pricing/rules";
import { buildSalesAssistantPrompt } from "@/services/messaging/sales-assistant";
import { formatSalesKnowledge, parseSalesKnowledge } from "./sales-knowledge";

const config = {
  model: "claude-sonnet-5",
  brandName: "ImpulsIA",
  brandDescription: "Automatizamos procesos para pymes.",
  contactEmail: "contacto@impulsialabs.cl",
  locale: "es-CL",
  catalog: defaultSolutionCatalog,
  pricing: currentPricingRules,
};

describe("sales knowledge", () => {
  it("el conocimiento publicado es válido y no expone datos personales", () => {
    const knowledge = parseSalesKnowledge(salesKnowledge);
    const text = JSON.stringify(knowledge);
    expect(knowledge.experience.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/\d{1,2}\.\d{3}\.\d{3}-[\dkK]/); // RUT
    expect(text).not.toMatch(/\+?56\s?9\s?\d{4}\s?\d{4}/); // teléfonos
    expect(text.toLowerCase()).not.toContain("tobalaba"); // el empleador no se nombra
  });

  it("formatea la experiencia con la advertencia de no inventar", () => {
    const section = formatSalesKnowledge(parseSalesKnowledge(salesKnowledge));
    expect(section).toContain("no inventes clientes, cifras ni resultados");
    expect(section).toContain("HL7");
    expect(section).toContain("Capacidades técnicas");
    expect(section).toContain("sin compromiso y sin costo");
    expect(section).toContain("Objeciones frecuentes");
    expect(section).toContain("Detalle técnico de implementación");
    expect(section).toContain("Row Level Security");
    expect(section).toContain("No prometas");
    expect(section).toContain("Cómo dimensionar las jornadas");
    expect(section).toContain("6 jornadas");
  });

  it("ofrece el paquete de profesionales independientes a precio cerrado, más IVA", () => {
    const prompt = buildSalesAssistantPrompt({ ...config, knowledge: parseSalesKnowledge(salesKnowledge) });
    expect(prompt).toContain("Ofertas con precio cerrado");
    expect(prompt).toMatch(/Asistente de WhatsApp para profesionales independientes: \$\s?150\.000 de implementación y \$\s?65\.000 mensuales/);
    expect(prompt).toContain("menos de $2.200 al día");
    expect(prompt).toContain("más IVA");
    expect(prompt).toContain("programa su ruta diaria");
    expect(prompt).toContain("da ese precio tal cual");
  });

  it("con nombre se presenta como Claudia sin anunciar la IA, pero nunca niega serlo", () => {
    const withPersona = buildSalesAssistantPrompt({ ...config, knowledge: parseSalesKnowledge(salesKnowledge) });
    expect(withPersona).toContain("Eres Claudia Álvarez, asistente de ventas de ImpulsIA");
    expect(withPersona).toContain("No menciones por iniciativa propia que eres una inteligencia artificial");
    expect(withPersona).toContain("responde siempre con la verdad");
    expect(withPersona).toContain("Nunca afirmes ni insinúes ser humana");

    const withoutPersona = buildSalesAssistantPrompt(config);
    expect(withoutPersona).toContain("una inteligencia artificial, aunque el cliente ya haya contado su caso");
  });

  it("el prompt pide español de Chile sin voseo y responder en el idioma del cliente", () => {
    const prompt = buildSalesAssistantPrompt(config);
    expect(prompt).toContain("chileno profesional");
    expect(prompt).toContain("Nunca uses voseo");
    expect(prompt).toContain("responde siempre en el idioma en que te escribe el cliente");
  });

  it("el prompt incluye el método de venta y la experiencia sólo si hay conocimiento", () => {
    const withKnowledge = buildSalesAssistantPrompt({ ...config, knowledge: parseSalesKnowledge(salesKnowledge), scheduling: { timeZone: "America/Santiago", meetingMinutes: 30 } });
    expect(withKnowledge).toContain("Método de venta consultiva");
    expect(withKnowledge).toContain("agendar una reunión");
    expect(withKnowledge).toContain("Experiencia real que puedes mencionar");

    const withoutKnowledge = buildSalesAssistantPrompt(config);
    expect(withoutKnowledge).toContain("no menciones experiencia previa ni casos");
    expect(withoutKnowledge).not.toContain("Experiencia real que puedes mencionar");
  });
});
