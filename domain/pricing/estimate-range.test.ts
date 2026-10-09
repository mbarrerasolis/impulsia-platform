import { describe, expect, it } from "vitest";
import { estimatePriceRange } from "./estimate-range";
import { currentPricingRules } from "./rules";

describe("estimatePriceRange", () => {
  it("calcula implementación y mantención con las reglas vigentes", () => {
    const range = estimatePriceRange({ complexity: "medium", minDays: 3, maxDays: 5 }, currentPricingRules);
    expect(range.implementationFrom).toBe(720_000);
    expect(range.implementationTo).toBe(1_200_000);
    expect(range.monthlyMaintenanceFrom).toBeGreaterThanOrEqual(currentPricingRules.minimumMaintenance);
    expect(range.currency).toBe("CLP");
  });

  it("ordena los días y respeta el mínimo de implementación", () => {
    const range = estimatePriceRange({ complexity: "standard", minDays: 0.5, maxDays: 0.25 }, currentPricingRules);
    expect(range.implementationFrom).toBe(currentPricingRules.minimumImplementation);
    expect(range.implementationTo).toBe(currentPricingRules.minimumImplementation);
  });
});
