import { describe, expect, it } from "vitest";
import templateEdition from "@/editions/_template/edition.json";
import { createBrandConfig } from "./brand";
import { createEditionConfig } from "./edition";

describe("edition commercial configuration", () => {
  it("conserva pricing y catálogo predeterminados", () => {
    const edition = createEditionConfig();
    expect(edition.pricing.currency).toBe("CLP");
    expect(edition.pricing.dayRate).toBe(200_000);
    expect(edition.catalog).toHaveLength(3);
    expect(edition.productShowcase).toHaveLength(4);
    expect(edition.caseStudies).toHaveLength(2);
  });

  it("permite reemplazar textos y ocultar galerías sin tocar componentes", () => {
    const edition = createEditionConfig({
      landingContentJson: JSON.stringify({ missionTitle: "Una propuesta propia de la nueva empresa." }),
      productShowcaseJson: "[]",
      caseStudiesJson: "[]",
    });
    expect(edition.landing.missionTitle).toBe("Una propuesta propia de la nueva empresa.");
    expect(edition.productShowcase).toEqual([]);
    expect(edition.caseStudies).toEqual([]);
  });

  it("crea una edición en otra moneda con catálogo propio", () => {
    const edition = createEditionConfig({
      locale: "es-MX",
      currency: "mxn",
      dayRate: "3500",
      minimumImplementation: "5000",
      minimumMaintenance: "900",
      roundingMultiple: "100",
      catalogJson: JSON.stringify([{ key: "reservas", name: "Automatización de reservas", category: "Operaciones", description: "Gestiona reservas y confirmaciones.", defaultDays: 3, defaultComplexity: "medium" }]),
    });
    expect(edition.locale).toBe("es-MX");
    expect(edition.pricing.currency).toBe("MXN");
    expect(edition.pricing.dayRate).toBe(3500);
    expect(edition.catalog[0]?.name).toBe("Automatización de reservas");
  });

  it("rechaza JSON inválido y monedas que no son ISO de tres letras", () => {
    expect(() => createEditionConfig({ catalogJson: "[" })).toThrow("SOLUTION_CATALOG_JSON");
    expect(() => createEditionConfig({ currency: "PESO" })).toThrow();
  });

  it("carga la plantilla B2B neutra como una edición ejecutable", () => {
    const brand = createBrandConfig(templateEdition.brand);
    const edition = createEditionConfig({
      locale: templateEdition.commerce.locale,
      currency: templateEdition.commerce.currency,
      pricingVersion: templateEdition.pricing.version,
      pricingEffectiveFrom: templateEdition.pricing.effectiveFrom,
      dayRate: String(templateEdition.pricing.dayRate),
      minimumImplementation: String(templateEdition.pricing.minimumImplementation),
      minimumMaintenance: String(templateEdition.pricing.minimumMaintenance),
      roundingMultiple: String(templateEdition.pricing.roundingMultiple),
      complexityFactorsJson: JSON.stringify(templateEdition.pricing.complexityFactors),
      maintenanceBracketsJson: JSON.stringify(templateEdition.pricing.maintenanceBrackets),
      expansionDiscountTiersJson: JSON.stringify(templateEdition.pricing.expansionDiscountTiers),
      catalogJson: JSON.stringify(templateEdition.catalog),
      landingContentJson: JSON.stringify(templateEdition.landing),
      productShowcaseJson: JSON.stringify(templateEdition.productShowcase),
      caseStudiesJson: JSON.stringify(templateEdition.caseStudies),
    });

    expect(brand.name).toBe("Marca B2B");
    expect(edition.landing.proofPanel.enabled).toBe(false);
    expect(edition.productShowcase).toEqual([]);
    expect(edition.caseStudies).toEqual([]);
  });
});
