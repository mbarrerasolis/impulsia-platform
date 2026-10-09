import { describe, expect, it } from "vitest";
import { createBrandConfig } from "./brand";

describe("brand configuration", () => {
  it("mantiene la identidad de ImpulsIA como configuración predeterminada", () => {
    const brand = createBrandConfig();
    expect(brand.name).toBe("ImpulsIA");
    expect(brand.contactHref).toBe("mailto:contacto@impulsialabs.cl");
    expect(brand.primaryRgb).toBe("15 118 110");
  });

  it("permite crear una edición comercial sin modificar código", () => {
    const brand = createBrandConfig({
      name: "Empresa Demo",
      legalName: "Empresa Demo SpA",
      contactEmail: "ventas@empresa.cl",
      primaryColor: "#123456",
      heroTitle: "Tu operación, conectada.",
    });
    expect(brand.name).toBe("Empresa Demo");
    expect(brand.legalName).toBe("Empresa Demo SpA");
    expect(brand.contactHref).toBe("mailto:ventas@empresa.cl");
    expect(brand.primaryRgb).toBe("18 52 86");
    expect(brand.heroTitle).toBe("Tu operación, conectada.");
  });

  it("acepta un RUT con formato chileno y rechaza otros formatos", () => {
    expect(createBrandConfig({ taxId: "78.519.493-4" }).taxId).toBe("78.519.493-4");
    expect(createBrandConfig({ taxId: "11.111.111-1" }).taxId).toBe("11.111.111-1");
    expect(createBrandConfig({}).taxId).toBeUndefined();
    expect(() => createBrandConfig({ taxId: "785194934" })).toThrow();
  });

  it("rechaza colores que no pueden usarse de forma segura en el tema", () => {
    expect(() => createBrandConfig({ primaryColor: "red" })).toThrow();
  });

  it("muestra sólo las redes sociales configuradas y exige URLs válidas", () => {
    expect(createBrandConfig().social).toEqual({});
    expect(createBrandConfig({ social: { instagram: "https://www.instagram.com/impulsialabs" } }).social)
      .toEqual({ instagram: "https://www.instagram.com/impulsialabs" });
    expect(() => createBrandConfig({ social: { instagram: "@impulsialabs" } })).toThrow();
  });
});
