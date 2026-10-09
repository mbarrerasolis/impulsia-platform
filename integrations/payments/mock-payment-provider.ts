import type { NormalizedPaymentEvent, PaymentProvider } from "./payment-provider";

export class MockPaymentProvider implements PaymentProvider {
  async createCustomer(input: { accountId: string }) {
    return { externalCustomerId: `mock_customer_${input.accountId}` };
  }
  async createPaymentLink(input: { billingPeriodId: string }) {
    return {
      url: `/pay/mock/${input.billingPeriodId}`,
      externalPaymentId: `mock_payment_${input.billingPeriodId}`
    };
  }
  async createOrUpdateSubscription(input: { subscriptionId: string }) {
    return { externalSubscriptionId: `mock_subscription_${input.subscriptionId}` };
  }
  async cancelSubscription() {}
  async handleWebhook(payload: unknown): Promise<NormalizedPaymentEvent> {
    const event = payload as NormalizedPaymentEvent;
    if (!event.externalEventId || !event.externalPaymentId) throw new Error("Evento mock inválido.");
    return event;
  }
  async getPaymentStatus() { return "pending" as const; }
}
