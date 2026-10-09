import type { OperationsRepository } from "@/repositories/operations-repository";
import { demoStore, type DemoStore } from "./demo-store";

export class MemoryOperationsRepository implements OperationsRepository {
  constructor(private readonly store: DemoStore = demoStore) {}
  async findLead(id: string) { return this.store.leads.find((item) => item.id === id); }
  async saveLead(lead: DemoStore["leads"][number]) { const index=this.store.leads.findIndex((item)=>item.id===lead.id); if(index<0) throw new Error("Lead inexistente."); this.store.leads[index]=lead; }
  async createAccount(account: DemoStore["accounts"][number]) { this.store.accounts.push(account); }
  async findAccount(id: string) { return this.store.accounts.find((item) => item.id === id); }
  async saveAccount(account: DemoStore["accounts"][number]) { const index=this.store.accounts.findIndex((item)=>item.id===account.id); if(index<0) throw new Error("Cuenta inexistente."); this.store.accounts[index]=account; }
  async createContact(contact: DemoStore["contacts"][number]) { this.store.contacts.push(contact); }
  async createQuote(quote: DemoStore["quotes"][number]) { this.store.quotes.push(quote); }
  async findQuote(id: string) { return this.store.quotes.find((item) => item.id === id); }
  async saveQuote(quote: DemoStore["quotes"][number]) { const index=this.store.quotes.findIndex((item)=>item.id===quote.id); if(index<0) throw new Error("Cotización inexistente."); this.store.quotes[index]=quote; }
  async createSolution(solution: DemoStore["solutions"][number]) { this.store.solutions.push(solution); }
  async listSolutions(accountId?: string) { return this.store.solutions.filter((item)=>!accountId||item.accountId===accountId); }
  async findActiveSubscription(accountId: string) { return this.store.subscriptions.find((item)=>item.accountId===accountId&&item.status==="active"); }
  async createSubscription(subscription: DemoStore["subscriptions"][number]) { this.store.subscriptions.push(subscription); }
  async createSubscriptionItem(item: DemoStore["subscriptionItems"][number]) { this.store.subscriptionItems.push(item); }
  async listSubscriptionItems(subscriptionId: string) { return this.store.subscriptionItems.filter((item)=>item.subscriptionId===subscriptionId); }
  async createBillingPeriod(period: DemoStore["billingPeriods"][number]) { this.store.billingPeriods.push(period); }
  async findBillingPeriod(id: string) { return this.store.billingPeriods.find((item)=>item.id===id); }
  async findBillingPeriodForSubscription(subscriptionId: string, periodStart: string) { return this.store.billingPeriods.find((item)=>item.subscriptionId===subscriptionId&&item.periodStart===periodStart); }
  async saveBillingPeriod(period: DemoStore["billingPeriods"][number]) { const index=this.store.billingPeriods.findIndex((item)=>item.id===period.id); if(index<0) throw new Error("Período inexistente."); this.store.billingPeriods[index]=period; }
  async listBillingPeriods() { return [...this.store.billingPeriods]; }
  async createPayment(payment: DemoStore["payments"][number]) { this.store.payments.push(payment); }
  async findPaymentByPeriod(periodId: string) { return this.store.payments.find((item)=>item.billingPeriodId===periodId); }
  async savePayment(payment: DemoStore["payments"][number]) { const index=this.store.payments.findIndex((item)=>item.id===payment.id); if(index<0) throw new Error("Pago inexistente."); this.store.payments[index]=payment; }
  async hasPaymentEvent(externalEventId: string) { return this.store.paymentEvents.some((item)=>item.externalEventId===externalEventId); }
  async createPaymentEvent(event: DemoStore["paymentEvents"][number]) { this.store.paymentEvents.push(event); }
  async createReminders(reminders: DemoStore["reminders"]) { this.store.reminders.push(...reminders); }
  async cancelScheduledReminders(periodId: string, at: string) { let count=0; this.store.reminders=this.store.reminders.map((item)=>{if(item.billingPeriodId===periodId&&item.status==="scheduled"){count+=1;return {...item,status:"cancelled" as const,cancelledAt:at};}return item;}); return count; }
  async listReminders(periodId: string) { return this.store.reminders.filter((item)=>item.billingPeriodId===periodId); }
  async createAudit(record: DemoStore["auditLog"][number]) { this.store.auditLog.push(record); }
}
