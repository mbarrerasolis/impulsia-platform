import type {
  ExpansionQuote,
  ExpansionQuoteInput,
  PricingRules,
  SubscriptionItem
} from "./types";

function assertNonNegative(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} debe ser un número no negativo.`);
  }
}

export function roundMoney(amount: number, multiple: number): number {
  if (!Number.isFinite(amount) || multiple <= 0) {
    throw new RangeError("El monto y el múltiplo de redondeo deben ser válidos.");
  }
  return Math.round(amount / multiple) * multiple;
}

export function calculateImplementationPrice(
  input: Pick<ExpansionQuoteInput, "estimatedDays" | "complexity">,
  rules: PricingRules
): number {
  assertNonNegative(input.estimatedDays, "estimatedDays");
  const factor = rules.complexityFactors[input.complexity];
  if (factor === undefined) throw new RangeError("Complejidad no configurada.");

  const calculated = input.estimatedDays * rules.dayRate * factor;
  return Math.max(
    rules.minimumImplementation,
    roundMoney(calculated, rules.roundingMultiple)
  );
}

export function getExpansionTier(
  activeSolutionsAfterAddition: number,
  rules: PricingRules
) {
  if (!Number.isInteger(activeSolutionsAfterAddition) || activeSolutionsAfterAddition < 1) {
    throw new RangeError("La cantidad de soluciones debe ser un entero mayor o igual a 1.");
  }

  const ordered = [...rules.expansionDiscountTiers].sort(
    (a, b) => a.fromSolution - b.fromSolution
  );
  const tier = ordered.filter(
    (candidate) => candidate.fromSolution <= activeSolutionsAfterAddition
  ).at(-1);

  if (!tier) throw new RangeError("No existe un tramo de expansión aplicable.");
  return tier;
}

export function calculateMaintenanceBase(
  implementationPrice: number,
  rules: PricingRules
): number {
  assertNonNegative(implementationPrice, "implementationPrice");
  const bracket = rules.maintenanceBrackets.find(
    ({ upTo }) => upTo === null || implementationPrice <= upTo
  );
  if (!bracket) throw new RangeError("No existe un tramo de mantención aplicable.");

  return roundMoney(
    Math.max(
      rules.minimumMaintenance,
      bracket.floor,
      implementationPrice * (bracket.ratePercent / 100)
    ),
    rules.roundingMultiple
  );
}

function applyDiscount(amount: number, discountPercent: number, rules: PricingRules) {
  return roundMoney(amount * (1 - discountPercent / 100), rules.roundingMultiple);
}

export function calculateExpansionQuote(
  input: ExpansionQuoteInput,
  rules: PricingRules
): ExpansionQuote {
  if (!Number.isInteger(input.activeSolutionsBeforeAddition) || input.activeSolutionsBeforeAddition < 0) {
    throw new RangeError("Las soluciones activas deben ser un entero no negativo.");
  }

  const activeSolutionsAfterAddition = input.activeSolutionsBeforeAddition + 1;
  const grossImplementation = calculateImplementationPrice(input, rules);
  const tier = getExpansionTier(activeSolutionsAfterAddition, rules);
  const grossMaintenanceIncrement = calculateMaintenanceBase(grossImplementation, rules);

  return {
    estimatedDays: input.estimatedDays,
    dayRate: rules.dayRate,
    complexity: input.complexity,
    complexityFactor: rules.complexityFactors[input.complexity],
    grossImplementation,
    activeSolutionsAfterAddition,
    expansionDiscountPercent: tier.discountPercent,
    netImplementation: applyDiscount(grossImplementation, tier.discountPercent, rules),
    grossMaintenanceIncrement,
    maintenanceDiscountPercent: tier.discountPercent,
    netMaintenanceIncrement: applyDiscount(
      grossMaintenanceIncrement,
      tier.discountPercent,
      rules
    ),
    thirdPartyCosts: structuredClone(input.thirdPartyCosts ?? []),
    pricingRuleVersion: rules.version,
    pricingSnapshot: structuredClone(rules),
    estimationNotes: input.estimationNotes
  };
}

export function calculateSubscriptionTotal(
  items: SubscriptionItem[],
  at: Date = new Date()
): number {
  const date = at.toISOString().slice(0, 10);
  return items
    .filter((item) => item.startsAt <= date && (!item.endsAt || item.endsAt >= date))
    .reduce((total, item) => {
      assertNonNegative(item.quantity, "quantity");
      if (item.netAmount !== undefined) {
        assertNonNegative(item.netAmount, "netAmount");
        return total + item.netAmount;
      }
      const gross = item.quantity * item.unitAmount;
      const discount = item.type === "third_party" ? 0 : item.discountPercent;
      return total + Math.round(gross * (1 - discount / 100));
    }, 0);
}
