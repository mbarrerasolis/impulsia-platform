export interface NormalizedPaymentEvent {
  externalEventId: string;
  externalPaymentId: string;
  status: "pending" | "approved" | "rejected" | "refunded" | "cancelled";
  amount: number;
  currency: string;
  occurredAt: string;
  /** Respuesta cruda del proveedor, para auditoría (payment_events.normalized_payload). */
  raw?: unknown;
}

export interface PaymentProvider {
  createCustomer(input: { accountId: string; email: string }): Promise<{ externalCustomerId: string }>;
  createPaymentLink(input: {
    billingPeriodId: string;
    amount: number;
    currency: string;
    /** Requerido por proveedores reales (p. ej. Flow); el mock lo ignora. */
    email?: string;
    description?: string;
  }): Promise<{ url: string; externalPaymentId: string }>;
  createOrUpdateSubscription(input: { subscriptionId: string; amount: number }): Promise<{ externalSubscriptionId: string }>;
  cancelSubscription(externalSubscriptionId: string): Promise<void>;
  handleWebhook(payload: unknown, signature?: string): Promise<NormalizedPaymentEvent>;
  getPaymentStatus(externalPaymentId: string): Promise<NormalizedPaymentEvent["status"]>;
}
