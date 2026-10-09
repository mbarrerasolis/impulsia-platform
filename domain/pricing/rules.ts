import type { PricingRules } from "./types";

export const currentPricingRules: PricingRules = {
  version: "2026-09-v1",
  effectiveFrom: "2026-09-01",
  currency: "CLP",
  dayRate: 200_000,
  minimumImplementation: 200_000,
  minimumMaintenance: 65_000,
  roundingMultiple: 1_000,
  complexityFactors: {
    standard: 1,
    medium: 1.2,
    high: 1.5,
    research: 1.75,
    advanced_research: 2
  },
  maintenanceBrackets: [
    { upTo: 400_000, ratePercent: 20, floor: 65_000 },
    { upTo: 1_000_000, ratePercent: 17.5, floor: 80_000 },
    { upTo: 2_000_000, ratePercent: 15, floor: 175_000 },
    { upTo: 4_000_000, ratePercent: 12, floor: 300_000 },
    { upTo: null, ratePercent: 10, floor: 480_000 }
  ],
  expansionDiscountTiers: [
    { fromSolution: 1, discountPercent: 0 },
    { fromSolution: 2, discountPercent: 25 },
    { fromSolution: 3, discountPercent: 30 },
    { fromSolution: 4, discountPercent: 35 },
    { fromSolution: 5, discountPercent: 40 }
  ]
};
