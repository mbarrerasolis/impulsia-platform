import type { AccountSummary, Contact, Lead } from "@/domain/crm/entities";
import type { AuditRecord, BillingPeriodRecord, ClientSolutionRecord, PaymentEventRecord, PaymentRecord, QuoteRecord, ReminderRecord, SubscriptionItemRecord, SubscriptionRecord } from "@/domain/operations/entities";

export interface OperationsRepository {
  findLead(id: string): Promise<Lead | undefined>;
  saveLead(lead: Lead): Promise<void>;
  createAccount(account: AccountSummary): Promise<void>;
  findAccount(id: string): Promise<AccountSummary | undefined>;
  saveAccount(account: AccountSummary): Promise<void>;
  createContact(contact: Contact): Promise<void>;
  createQuote(quote: QuoteRecord): Promise<void>;
  findQuote(id: string): Promise<QuoteRecord | undefined>;
  saveQuote(quote: QuoteRecord): Promise<void>;
  createSolution(solution: ClientSolutionRecord): Promise<void>;
  listSolutions(accountId?: string): Promise<ClientSolutionRecord[]>;
  findActiveSubscription(accountId: string): Promise<SubscriptionRecord | undefined>;
  createSubscription(subscription: SubscriptionRecord): Promise<void>;
  createSubscriptionItem(item: SubscriptionItemRecord): Promise<void>;
  listSubscriptionItems(subscriptionId: string): Promise<SubscriptionItemRecord[]>;
  createBillingPeriod(period: BillingPeriodRecord): Promise<void>;
  findBillingPeriod(id: string): Promise<BillingPeriodRecord | undefined>;
  findBillingPeriodForSubscription(subscriptionId: string, periodStart: string): Promise<BillingPeriodRecord | undefined>;
  saveBillingPeriod(period: BillingPeriodRecord): Promise<void>;
  listBillingPeriods(): Promise<BillingPeriodRecord[]>;
  createPayment(payment: PaymentRecord): Promise<void>;
  findPaymentByPeriod(periodId: string): Promise<PaymentRecord | undefined>;
  savePayment(payment: PaymentRecord): Promise<void>;
  hasPaymentEvent(externalEventId: string): Promise<boolean>;
  createPaymentEvent(event: PaymentEventRecord): Promise<void>;
  createReminders(reminders: ReminderRecord[]): Promise<void>;
  cancelScheduledReminders(periodId: string, at: string): Promise<number>;
  listReminders(periodId: string): Promise<ReminderRecord[]>;
  createAudit(record: AuditRecord): Promise<void>;
}
