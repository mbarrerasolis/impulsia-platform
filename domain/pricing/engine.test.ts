import { describe, expect, it } from "vitest";
import {
  calculateExpansionQuote,
  calculateImplementationPrice,
  calculateMaintenanceBase,
  calculateSubscriptionTotal,
  getExpansionTier
} from "./engine";
import { currentPricingRules as rules } from "./rules";

describe("calculateImplementationPrice", () => {
  it("respeta el proyecto mínimo", () => {
    expect(calculateImplementationPrice({ estimatedDays: 0.25, complexity: "standard" }, rules))
      .toBe(200_000);
  });

  it.each([
    ["standard", 1],
    ["medium", 1.2],
    ["high", 1.5],
    ["research", 1.75],
    ["advanced_research", 2]
  ] as const)("aplica el factor %s", (complexity, factor) => {
    expect(calculateImplementationPrice({ estimatedDays: 2, complexity }, rules))
      .toBe(400_000 * factor);
  });
});

describe("calculateMaintenanceBase", () => {
  it.each([
    [400_000, 80_000],
    [400_001, 80_000],
    [1_000_000, 175_000],
    [1_000_001, 175_000],
    [2_000_000, 300_000],
    [2_000_001, 300_000],
    [4_000_000, 480_000],
    [4_000_001, 480_000]
  ])("calcula el borde %i", (amount, expected) => {
    expect(calculateMaintenanceBase(amount, rules)).toBe(expected);
  });

  it("es monótona en todo el rango comercial", () => {
    let previous = 0;
    for (let amount = 0; amount <= 8_000_000; amount += 1_000) {
      const current = calculateMaintenanceBase(amount, rules);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe("expansión", () => {
  it.each([[1, 0], [2, 25], [3, 30], [4, 35], [5, 40], [9, 40]])(
    "aplica %i solución(es) => %i%%",
    (count, discount) => {
      expect(getExpansionTier(count, rules).discountPercent).toBe(discount);
    }
  );

  it("genera un snapshot y deja terceros sin descuento", () => {
    const quote = calculateExpansionQuote({
      estimatedDays: 3,
      complexity: "medium",
      activeSolutionsBeforeAddition: 2,
      thirdPartyCosts: [{
        provider: "Proveedor demo",
        description: "Consumo API",
        cost: 50_000,
        currency: "CLP",
        periodicity: "monthly",
        paidBy: "rebilled"
      }]
    }, rules);

    expect(quote).toMatchObject({
      grossImplementation: 720_000,
      expansionDiscountPercent: 30,
      netImplementation: 504_000,
      grossMaintenanceIncrement: 126_000,
      netMaintenanceIncrement: 88_000,
      pricingRuleVersion: "2026-09-v1"
    });
    expect(quote.thirdPartyCosts[0].cost).toBe(50_000);
  });

  it("no muta cotizaciones históricas cuando cambian las reglas", () => {
    const quote = calculateExpansionQuote({
      estimatedDays: 2,
      complexity: "standard",
      activeSolutionsBeforeAddition: 0
    }, rules);
    const changedRules = structuredClone(rules);
    changedRules.dayRate = 500_000;
    expect(quote.dayRate).toBe(200_000);
    expect(quote.pricingSnapshot.dayRate).toBe(200_000);
  });
});

describe("calculateSubscriptionTotal", () => {
  it("suma items activos y nunca descuenta costos de terceros", () => {
    expect(calculateSubscriptionTotal([
      { id: "1", type: "maintenance", quantity: 1, unitAmount: 100_000, discountPercent: 25, startsAt: "2026-01-01" },
      { id: "2", type: "third_party", quantity: 1, unitAmount: 40_000, discountPercent: 99, startsAt: "2026-01-01" },
      { id: "3", type: "maintenance", quantity: 1, unitAmount: 10_000, discountPercent: 0, startsAt: "2025-01-01", endsAt: "2025-12-31" }
    ], new Date("2026-09-01T00:00:00Z"))).toBe(115_000);
  });

  it("respeta el neto comercial persistido y no recalcula su redondeo", () => {
    expect(calculateSubscriptionTotal([
      { id:"1", type:"maintenance", quantity:1, unitAmount:126_000, discountPercent:25, netAmount:95_000, startsAt:"2026-01-01" }
    ],new Date("2026-09-01T00:00:00Z"))).toBe(95_000);
  });
});
