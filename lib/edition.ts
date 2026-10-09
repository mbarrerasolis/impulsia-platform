import "server-only";
import activeEdition from "@/config/edition.json";
import { createEditionConfig } from "@/domain/config/edition";

function mergeJsonObjectOverride(value: string | undefined, baseline: object, label: string) {
  if (!value) return JSON.stringify(baseline);
  let override: unknown;
  try {
    override = JSON.parse(value);
  } catch {
    throw new Error(`${label} debe contener JSON válido.`);
  }
  if (!override || Array.isArray(override) || typeof override !== "object") {
    throw new Error(`${label} debe contener un objeto JSON.`);
  }
  return JSON.stringify({ ...baseline, ...override });
}

export function getEditionConfig() {
  return createEditionConfig({
    locale: process.env.NEXT_PUBLIC_COMMERCE_LOCALE || activeEdition.commerce.locale,
    currency: process.env.NEXT_PUBLIC_COMMERCE_CURRENCY || activeEdition.commerce.currency,
    pricingVersion: process.env.PRICING_VERSION || activeEdition.pricing.version,
    pricingEffectiveFrom: process.env.PRICING_EFFECTIVE_FROM || activeEdition.pricing.effectiveFrom,
    dayRate: process.env.PRICING_DAY_RATE || String(activeEdition.pricing.dayRate),
    minimumImplementation: process.env.PRICING_MINIMUM_IMPLEMENTATION || String(activeEdition.pricing.minimumImplementation),
    minimumMaintenance: process.env.PRICING_MINIMUM_MAINTENANCE || String(activeEdition.pricing.minimumMaintenance),
    roundingMultiple: process.env.PRICING_ROUNDING_MULTIPLE || String(activeEdition.pricing.roundingMultiple),
    complexityFactorsJson: process.env.PRICING_COMPLEXITY_FACTORS_JSON || JSON.stringify(activeEdition.pricing.complexityFactors),
    maintenanceBracketsJson: process.env.PRICING_MAINTENANCE_BRACKETS_JSON || JSON.stringify(activeEdition.pricing.maintenanceBrackets),
    expansionDiscountTiersJson: process.env.PRICING_EXPANSION_DISCOUNT_TIERS_JSON || JSON.stringify(activeEdition.pricing.expansionDiscountTiers),
    catalogJson: process.env.SOLUTION_CATALOG_JSON || JSON.stringify(activeEdition.catalog),
    landingContentJson: mergeJsonObjectOverride(process.env.LANDING_CONTENT_JSON, activeEdition.landing, "LANDING_CONTENT_JSON"),
    productShowcaseJson: process.env.PRODUCT_SHOWCASE_JSON || JSON.stringify(activeEdition.productShowcase),
    caseStudiesJson: process.env.CASE_STUDIES_JSON || JSON.stringify(activeEdition.caseStudies),
  });
}
