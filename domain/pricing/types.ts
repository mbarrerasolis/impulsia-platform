export type ComplexityKey =
  | "standard"
  | "medium"
  | "high"
  | "research"
  | "advanced_research";

export interface MaintenanceBracket {
  upTo: number | null;
  ratePercent: number;
  floor: number;
}

export interface ExpansionDiscountTier {
  fromSolution: number;
  discountPercent: number;
}

export interface PricingRules {
  version: string;
  effectiveFrom: string;
  currency: string;
  dayRate: number;
  minimumImplementation: number;
  minimumMaintenance: number;
  roundingMultiple: number;
  complexityFactors: Record<ComplexityKey, number>;
  maintenanceBrackets: MaintenanceBracket[];
  expansionDiscountTiers: ExpansionDiscountTier[];
}

export interface ThirdPartyCostItem {
  provider: string;
  description: string;
  cost: number;
  currency: string;
  periodicity: "one_time" | "monthly" | "annual" | "usage";
  paidBy: "client_direct" | "rebilled";
  markupPercent?: number;
}

export interface ExpansionQuoteInput {
  estimatedDays: number;
  complexity: ComplexityKey;
  activeSolutionsBeforeAddition: number;
  thirdPartyCosts?: ThirdPartyCostItem[];
  estimationNotes?: string;
}

export interface ExpansionQuote {
  estimatedDays: number;
  dayRate: number;
  complexity: ComplexityKey;
  complexityFactor: number;
  grossImplementation: number;
  activeSolutionsAfterAddition: number;
  expansionDiscountPercent: number;
  netImplementation: number;
  grossMaintenanceIncrement: number;
  maintenanceDiscountPercent: number;
  netMaintenanceIncrement: number;
  thirdPartyCosts: ThirdPartyCostItem[];
  pricingRuleVersion: string;
  pricingSnapshot: PricingRules;
  estimationNotes?: string;
}

export interface SubscriptionItem {
  id: string;
  type: "maintenance" | "third_party" | "manual_adjustment";
  quantity: number;
  unitAmount: number;
  discountPercent: number;
  netAmount?: number;
  startsAt: string;
  endsAt?: string | null;
}
