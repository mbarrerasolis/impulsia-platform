import { describe, expect, it } from "vitest";
import activeEdition from "@/config/edition.json";
import templateEdition from "@/editions/_template/edition.json";
import { businessVocabulary, moduleProblems, parseBusinessProfile } from "./business";

describe("parseBusinessProfile", () => {
  it("sin perfil asume servicios B2B con todos sus módulos (ediciones existentes)", () => {
    expect(parseBusinessProfile()).toEqual({
      model: "b2b",
      offering: "services",
      modules: { quotes: true, subscriptions: true, clientPortal: true, whatsapp: true, meetings: true, store: false, erp: false },
      sectorLandings: [],
    });
  });

  it("un negocio de productos B2C parte con tienda y sin cotizador", () => {
    const profile = parseBusinessProfile({ business: { model: "b2c", offering: "products" }, modules: { erp: true } });
    expect(profile.modules).toMatchObject({ store: true, erp: true, quotes: false, subscriptions: false, clientPortal: false, meetings: false, whatsapp: true });
  });

  it("rechaza combinaciones incoherentes", () => {
    expect(() => parseBusinessProfile({ business: { model: "b2c", offering: "products" }, modules: { quotes: true } })).toThrow(/cotizador/);
    expect(() => parseBusinessProfile({ modules: { quotes: false } })).toThrow(/Soluciones y cobranza requieren el cotizador/);
    expect(() => parseBusinessProfile({ modules: { whatsapp: false } })).toThrow(/agenda/);
  });

  it("rechaza módulos desconocidos para no ocultar errores de tipeo", () => {
    expect(() => parseBusinessProfile({ modules: { tienda: true } })).toThrow();
  });

  it("acepta landings sectoriales conocidas", () => {
    expect(parseBusinessProfile({ modules: { sectorLandings: ["salud"] } }).sectorLandings).toEqual(["salud"]);
    expect(() => parseBusinessProfile({ modules: { sectorLandings: ["mineria"] } })).toThrow();
  });
});

describe("ediciones del repositorio", () => {
  it("la edición activa y la plantilla tienen perfiles válidos", () => {
    expect(() => parseBusinessProfile(activeEdition)).not.toThrow();
    expect(() => parseBusinessProfile(templateEdition)).not.toThrow();
  });
});

describe("moduleProblems / businessVocabulary", () => {
  it("una edición mixta permite cotizador y tienda a la vez", () => {
    expect(moduleProblems({ offering: "mixed", modules: { quotes: true, subscriptions: true, clientPortal: true, whatsapp: true, meetings: true, store: true, erp: true } })).toEqual([]);
  });
  it("B2C habla de clientes, no de cuentas", () => {
    expect(businessVocabulary("b2c").accounts).toBe("Clientes");
    expect(businessVocabulary("b2b").accounts).toBe("Cuentas");
  });
});
