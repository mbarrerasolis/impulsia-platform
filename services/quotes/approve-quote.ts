import { calculateSubscriptionTotal } from "@/domain/pricing/engine";
import { schedulePaymentReminders } from "@/domain/billing/reminders";
import type { SubscriptionItemRecord } from "@/domain/operations/entities";
import type { OperationsRepository } from "@/repositories/operations-repository";

function monthBounds(at: Date, billingDay: number) {
  const year = at.getUTCFullYear(); const month = at.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  const due = new Date(Date.UTC(year, month, Math.min(billingDay, end.getUTCDate()), 12));
  return { periodStart: start.toISOString().slice(0,10), periodEnd: end.toISOString().slice(0,10), dueDate: due.toISOString().slice(0,10), due };
}

export class ApproveQuoteService {
  constructor(private readonly repository: OperationsRepository, private readonly options: { now?: () => Date; id?: () => string; actorUserId?: string } = {}) {}
  async execute(quoteId: string) {
    const quote = await this.repository.findQuote(quoteId);
    if (!quote) throw new Error("Cotización no encontrada.");
    if (quote.status !== "draft") throw new Error("La cotización ya fue procesada.");
    const account = await this.repository.findAccount(quote.accountId);
    if (!account) throw new Error("Cuenta no encontrada.");

    const id = this.options.id ?? crypto.randomUUID;
    const nowDate = (this.options.now ?? (() => new Date()))();
    const now = nowDate.toISOString();
    const today = now.slice(0,10);
    const solution = {
      id: id(), accountId: quote.accountId, quoteId: quote.id, name: quote.name, status: "approved" as const,
      estimatedDays: quote.estimatedDays, complexityFactor: quote.complexityFactor, dayRateSnapshot: quote.dayRate,
      grossImplementationPrice: quote.grossImplementation, expansionDiscountPercent: quote.expansionDiscountPercent,
      netImplementationPrice: quote.netImplementation, grossMaintenanceIncrement: quote.grossMaintenanceIncrement,
      maintenanceDiscountPercent: quote.maintenanceDiscountPercent, netMaintenanceIncrement: quote.netMaintenanceIncrement,
      pricingSnapshot: structuredClone(quote.pricingSnapshot), createdAt: now
    };
    await this.repository.createSolution(solution);

    let subscription = await this.repository.findActiveSubscription(account.id);
    if (!subscription) {
      subscription = { id: id(), accountId: account.id, status: "active", billingDay: 20, currency: quote.pricingSnapshot.currency, startedAt: today };
      await this.repository.createSubscription(subscription);
    }
    if (subscription.currency !== quote.pricingSnapshot.currency) {
      throw new Error("La moneda de la cotización no coincide con la suscripción activa. Crea una edición o suscripción separada para cambiar de moneda.");
    }
    const maintenanceItem = {
      id: id(), subscriptionId: subscription.id, clientSolutionId: solution.id, type: "maintenance" as const,
      name: `Mantención · ${solution.name}`, quantity: 1, unitAmount: quote.grossMaintenanceIncrement,
      discountPercent: quote.maintenanceDiscountPercent, netAmount: quote.netMaintenanceIncrement,
      thirdParty: false, startsAt: today
    };
    await this.repository.createSubscriptionItem(maintenanceItem);
    const newItems: SubscriptionItemRecord[] = [maintenanceItem];
    for (const cost of quote.thirdPartyCosts.filter((item) => item.periodicity === "monthly" && item.paidBy === "rebilled")) {
      const item = { id: id(), subscriptionId: subscription.id, clientSolutionId: solution.id, type: "third_party" as const, name: `${cost.provider} · ${cost.description}`, quantity: 1, unitAmount: cost.cost, discountPercent: 0, netAmount: cost.cost, thirdParty: true, startsAt: today };
      await this.repository.createSubscriptionItem(item); newItems.push(item);
    }
    const allItems = await this.repository.listSubscriptionItems(subscription.id);
    const amountDue = calculateSubscriptionTotal(allItems.map((item)=>({ id:item.id, type:item.type, quantity:item.quantity, unitAmount:item.unitAmount, discountPercent:item.discountPercent, netAmount:item.netAmount, startsAt:item.startsAt, endsAt:item.endsAt })), nowDate);
    let billingDate = nowDate;
    let bounds = monthBounds(billingDate, subscription.billingDay);
    let existingPeriod = await this.repository.findBillingPeriodForSubscription(subscription.id,bounds.periodStart);
    if(existingPeriod?.status==="paid"||existingPeriod?.status==="void"){
      billingDate=new Date(Date.UTC(nowDate.getUTCFullYear(),nowDate.getUTCMonth()+1,1));
      bounds=monthBounds(billingDate,subscription.billingDay);
      existingPeriod=await this.repository.findBillingPeriodForSubscription(subscription.id,bounds.periodStart);
    }
    const period = existingPeriod ? {
      ...existingPeriod, amountDue, pricingSnapshot:{subscriptionItemIds:allItems.map((item)=>item.id),generatedAt:now}
    } : {
      id:id(),subscriptionId:subscription.id,accountId:account.id,
      periodStart:bounds.periodStart,periodEnd:bounds.periodEnd,dueDate:bounds.dueDate,
      amountDue,amountPaid:0,status:"pending" as const,
      pricingSnapshot:{subscriptionItemIds:allItems.map((item)=>item.id),generatedAt:now}
    };
    if(existingPeriod) await this.repository.saveBillingPeriod(period); else {
      await this.repository.createBillingPeriod(period);
      await this.repository.createReminders(schedulePaymentReminders(bounds.due).map((reminder)=>({ id:id(),billingPeriodId:period.id,scheduledAt:reminder.scheduledAt.toISOString(),offsetDays:reminder.offsetDays,status:"scheduled" as const,kind:reminder.kind })));
    }
    await this.repository.saveQuote({ ...quote, status: "approved", approvedAt: now });
    account.activeSolutions += 1; account.mrr = amountDue; account.status = "active";
    await this.repository.saveAccount(account);
    await this.repository.createAudit({ id:id(), actorUserId:this.options.actorUserId??"demo-owner", accountId:account.id, entityType:"quote", entityId:quote.id, action:"quote.approved", before:{status:"draft"}, after:{status:"approved",solutionId:solution.id,subscriptionId:subscription.id,billingPeriodId:period.id}, createdAt:now });
    return { quote: { ...quote, status: "approved" as const, approvedAt: now }, solution, subscription, items: newItems, billingPeriod: period };
  }
}
