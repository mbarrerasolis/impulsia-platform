import { calculateImplementationPrice, calculateMaintenanceBase } from "./engine";
import type { ComplexityKey, PricingRules } from "./types";

export interface PriceRangeEstimate {
  currency: string;
  implementationFrom: number;
  implementationTo: number;
  monthlyMaintenanceFrom: number;
  monthlyMaintenanceTo: number;
  pricingVersion: string;
}

/** Rango referencial para conversaciones comerciales; la cotización formal sigue siendo del equipo. */
export function estimatePriceRange(
  input: { complexity: ComplexityKey; minDays: number; maxDays: number },
  rules: PricingRules
): PriceRangeEstimate {
  const minDays = Math.min(input.minDays, input.maxDays);
  const maxDays = Math.max(input.minDays, input.maxDays);
  const implementationFrom = calculateImplementationPrice({ estimatedDays: minDays, complexity: input.complexity }, rules);
  const implementationTo = calculateImplementationPrice({ estimatedDays: maxDays, complexity: input.complexity }, rules);
  return {
    currency: rules.currency,
    implementationFrom,
    implementationTo,
    monthlyMaintenanceFrom: calculateMaintenanceBase(implementationFrom, rules),
    monthlyMaintenanceTo: calculateMaintenanceBase(implementationTo, rules),
    pricingVersion: rules.version,
  };
}
