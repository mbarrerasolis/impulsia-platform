import type { ExpansionQuote } from "@/domain/pricing/types";

export interface QuoteRecord extends ExpansionQuote {
  id: string;
  accountId: string;
  name: string;
  status: "draft" | "approved" | "rejected";
  createdAt: string;
  approvedAt?: string;
}

export interface ClientSolutionRecord {
  id: string;
  accountId: string;
  quoteId: string;
  name: string;
  status: "approved" | "development" | "testing" | "production" | "paused" | "cancelled";
  estimatedDays: number;
  complexityFactor: number;
  dayRateSnapshot: number;
  grossImplementationPrice: number;
  expansionDiscountPercent: number;
  netImplementationPrice: number;
  grossMaintenanceIncrement: number;
  maintenanceDiscountPercent: number;
  netMaintenanceIncrement: number;
  pricingSnapshot: ExpansionQuote["pricingSnapshot"];
  createdAt: string;
}

export interface ImplementationTaskRecord {
  id: string;
  clientSolutionId: string;
  title: string;
  status: "pending" | "in_progress" | "done" | "blocked";
  assignee?: string;
  assigneeName?: string;
  estimateHours?: number;
  actualHours?: number;
  dueDate?: string;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  accountId: string;
  status: "active" | "paused" | "cancelled";
  billingDay: number;
  currency: string;
  startedAt: string;
}

export interface SubscriptionItemRecord {
  id: string;
  subscriptionId: string;
  clientSolutionId: string;
  type: "maintenance" | "third_party";
  name: string;
  quantity: number;
  unitAmount: number;
  discountPercent: number;
  netAmount: number;
  thirdParty: boolean;
  startsAt: string;
  endsAt?: string;
}

export interface BillingPeriodRecord {
  id: string;
  subscriptionId: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  status: "upcoming" | "pending" | "paid" | "overdue" | "void";
  pricingSnapshot: { subscriptionItemIds: string[]; generatedAt: string };
}

export interface PaymentRecord {
  id: string;
  billingPeriodId: string;
  provider: "mock";
  externalPaymentId: string;
  amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "refunded" | "cancelled";
  paidAt?: string;
}

export interface PaymentEventRecord {
  id: string;
  provider: "mock";
  externalEventId: string;
  paymentId: string;
  status: PaymentRecord["status"];
  receivedAt: string;
}

export interface ReminderRecord {
  id: string;
  billingPeriodId: string;
  scheduledAt: string;
  offsetDays: number;
  status: "scheduled" | "sent" | "cancelled";
  kind: "automatic" | "manual_alert";
  cancelledAt?: string;
}

export interface AuditRecord {
  id: string;
  actorUserId: string;
  accountId?: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}
