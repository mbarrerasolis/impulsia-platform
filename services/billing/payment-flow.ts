import { assertPaymentTransition } from "@/domain/billing/payment";
import type { PaymentProvider } from "@/integrations/payments/payment-provider";
import type { OperationsRepository } from "@/repositories/operations-repository";

export class CreatePaymentLinkService {
  constructor(private readonly repository: OperationsRepository, private readonly provider: PaymentProvider, private readonly id: () => string = crypto.randomUUID, private readonly currency = "CLP") {}
  async execute(periodId: string) {
    const period = await this.repository.findBillingPeriod(periodId);
    if (!period || period.status === "paid" || period.status === "void") throw new Error("El período no admite un nuevo pago.");
    const existing = await this.repository.findPaymentByPeriod(periodId);
    if (existing) return { payment: existing, url: `/pay/mock/${periodId}` };
    const link = await this.provider.createPaymentLink({ billingPeriodId: period.id, amount: period.amountDue, currency: this.currency });
    const payment = { id:this.id(), billingPeriodId:period.id, provider:"mock" as const, externalPaymentId:link.externalPaymentId, amount:period.amountDue, currency:this.currency, status:"pending" as const };
    await this.repository.createPayment(payment);
    return { payment, url: link.url };
  }
}

export class ProcessPaymentEventService {
  constructor(private readonly repository: OperationsRepository, private readonly options: { now?: () => Date; id?: () => string; actorUserId?: string } = {}) {}
  async execute(input: { periodId: string; externalEventId: string }) {
    if (await this.repository.hasPaymentEvent(input.externalEventId)) return { idempotent: true, cancelledReminders: 0 };
    const period = await this.repository.findBillingPeriod(input.periodId);
    const payment = await this.repository.findPaymentByPeriod(input.periodId);
    if (!period || !payment) throw new Error("Pago o período no encontrado.");
    if (payment.amount !== period.amountDue || !/^[A-Z]{3}$/.test(payment.currency)) throw new Error("El monto o la moneda persistida no coincide con el período.");
    assertPaymentTransition(payment.status, "approved");
    const id=this.options.id??crypto.randomUUID; const now=(this.options.now??(()=>new Date()))().toISOString();
    await this.repository.createPaymentEvent({ id:id(), provider:"mock", externalEventId:input.externalEventId, paymentId:payment.id, status:"approved", receivedAt:now });
    await this.repository.savePayment({ ...payment, status:"approved", paidAt:now });
    await this.repository.saveBillingPeriod({ ...period, status:"paid", amountPaid:period.amountDue });
    const cancelledReminders=await this.repository.cancelScheduledReminders(period.id,now);
    await this.repository.createAudit({ id:id(), actorUserId:this.options.actorUserId??"mock-provider", accountId:period.accountId, entityType:"payment", entityId:payment.id, action:"payment.approved", before:{status:payment.status}, after:{status:"approved",amount:payment.amount,cancelledReminders}, createdAt:now });
    return { idempotent:false, cancelledReminders, paymentId:payment.id };
  }
}
