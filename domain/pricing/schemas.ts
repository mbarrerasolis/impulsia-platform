import { z } from "zod";
import type { PricingRules, ThirdPartyCostItem } from "./types";

export const thirdPartyCostItemSchema: z.ZodType<ThirdPartyCostItem> = z.object({
  provider: z.string(),
  description: z.string(),
  cost: z.number(),
  currency: z.string(),
  periodicity: z.enum(["one_time", "monthly", "annual", "usage"]),
  paidBy: z.enum(["client_direct", "rebilled"]),
  markupPercent: z.number().optional(),
});

export const thirdPartyCostItemsSchema = z.array(thirdPartyCostItemSchema);

export const pricingRulesSchema: z.ZodType<PricingRules> = z.object({
  version: z.string(),
  effectiveFrom: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  dayRate: z.number(),
  minimumImplementation: z.number(),
  minimumMaintenance: z.number(),
  roundingMultiple: z.number(),
  complexityFactors: z.object({
    standard: z.number(),
    medium: z.number(),
    high: z.number(),
    research: z.number(),
    advanced_research: z.number(),
  }),
  maintenanceBrackets: z.array(
    z.object({
      upTo: z.number().nullable(),
      ratePercent: z.number(),
      floor: z.number(),
    }),
  ),
  expansionDiscountTiers: z.array(
    z.object({
      fromSolution: z.number(),
      discountPercent: z.number(),
    }),
  ),
});
