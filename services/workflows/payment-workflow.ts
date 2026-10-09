import { getServerEnv } from "@/lib/env";
import { createPaymentProvider } from "@/integrations/payments";
import { MockPaymentProvider } from "@/integrations/payments/mock-payment-provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toJson } from "@/lib/supabase/json";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOperationsRepository } from "@/repositories";
import { getEditionConfig } from "@/lib/edition";
import { CreatePaymentLinkService } from "@/services/billing/payment-flow";

export interface PaymentLinkResult {
  payment: { id: string; status: string };
  url: string;
}

export interface ManualPaymentInput {
  reference: string;
  paidAt?: string;
}

export interface ManualPaymentResult {
  paymentId: string;
  cancelledReminders: number;
}

export interface PaymentWorkflow {
  createPaymentLink(billingPeriodId: string): Promise<PaymentLinkResult>;
  recordManualPayment(billingPeriodId: string, input: ManualPaymentInput, actorUserId: string): Promise<ManualPaymentResult>;
}

class MemoryPaymentWorkflow implements PaymentWorkflow {
  async createPaymentLink(billingPeriodId: string): Promise<PaymentLinkResult> {
    const result = await new CreatePaymentLinkService(getOperationsRepository(), new MockPaymentProvider(), crypto.randomUUID, getEditionConfig().pricing.currency).execute(billingPeriodId);
    return { payment: { id: result.payment.id, status: result.payment.status }, url: result.url };
  }

  async recordManualPayment(): Promise<ManualPaymentResult> {
    throw new Error("El pago manual sólo está disponible en modo Supabase. En demo usa el pago mock desde el link.");
  }
}

export class SupabasePaymentWorkflow implements PaymentWorkflow {
  async createPaymentLink(billingPeriodId: string): Promise<PaymentLinkResult> {
    const client = await createSupabaseServerClient();
    const { data: period, error: periodError } = await client
      .from("billing_periods")
      .select("*,subscriptions!inner(account_id,currency)")
      .eq("id", billingPeriodId)
      .single();
    if (periodError || !period) throw new Error("Período no encontrado.");
    if (period.status === "paid" || period.status === "void") throw new Error("El período no admite un nuevo pago.");
    const accountId = period.subscriptions.account_id;
    const currency = period.subscriptions.currency;

    const existing = await client.from("payments").select("id,status,raw_provider_payload").eq("billing_period_id", billingPeriodId).maybeSingle();
    if (existing.error) throw new Error(`No fue posible verificar pagos previos: ${existing.error.message}`);
    if (existing.data) {
      const raw = existing.data.raw_provider_payload as { url?: string } | null;
      if (!raw?.url) throw new Error("El pago de este período existe pero su link quedó inexistente; contacta a soporte.");
      return { payment: { id: existing.data.id, status: existing.data.status }, url: raw.url };
    }

    const { data: contacts, error: contactsError } = await client
      .from("contacts")
      .select("email,is_primary_billing,contact_roles(role)")
      .eq("account_id", accountId)
      .eq("is_active", true);
    if (contactsError) throw new Error(`No fue posible cargar contactos: ${contactsError.message}`);
    const billingContact = (contacts ?? [])
      .filter((contact) => contact.contact_roles.some((item) => item.role === "billing"))
      .sort((a, b) => Number(b.is_primary_billing) - Number(a.is_primary_billing))[0];
    if (!billingContact) throw new Error("Contacto de facturación inexistente para esta cuenta.");

    const { data: account, error: accountError } = await client.from("accounts").select("trade_name").eq("id", accountId).single();
    if (accountError || !account) throw new Error("Cuenta no encontrada.");

    const provider = createPaymentProvider();
    const link = await provider.createPaymentLink({
      billingPeriodId: period.id,
      amount: period.amount_due,
      currency,
      email: billingContact.email,
      description: `Cobranza ${account.trade_name} · ${period.period_start} a ${period.period_end}`,
    });

    const admin = createSupabaseAdminClient();
    const { data: inserted, error: insertError } = await admin
      .from("payments")
      .insert({
        billing_period_id: period.id,
        provider: getServerEnv().PAYMENT_PROVIDER,
        external_payment_id: link.externalPaymentId,
        amount: period.amount_due,
        currency,
        status: "pending",
        raw_provider_payload: toJson({ url: link.url }),
      })
      .select("id,status")
      .single();
    if (insertError || !inserted) throw new Error(`No fue posible registrar el pago: ${insertError?.message ?? "sin respuesta"}`);

    return { payment: { id: inserted.id, status: inserted.status }, url: link.url };
  }

  async recordManualPayment(billingPeriodId: string, input: ManualPaymentInput, actorUserId: string): Promise<ManualPaymentResult> {
    const reference = input.reference.trim();
    if (reference.length < 5) throw new Error("Describe la evidencia del pago (banco, N° de transferencia o comprobante).");

    const client = await createSupabaseServerClient();
    const { data: period, error: periodError } = await client.from("billing_periods").select("id,amount_due,status,subscriptions!inner(currency)").eq("id", billingPeriodId).single();
    if (periodError || !period) throw new Error("Período no encontrado.");
    if (period.status === "paid" || period.status === "void") throw new Error("El período no admite un nuevo pago.");

    const externalId = `manual-${billingPeriodId}-${Date.now()}`;
    const normalizedPayload = { reference, paidAt: input.paidAt ?? null, recordedBy: actorUserId, source: "manual" as const };

    const admin = createSupabaseAdminClient();
    const { data: payment, error: insertError } = await admin
      .from("payments")
      .insert({
        billing_period_id: period.id,
        provider: "manual",
        external_payment_id: externalId,
        amount: period.amount_due,
        currency: period.subscriptions.currency,
        status: "pending",
        raw_provider_payload: toJson(normalizedPayload),
      })
      .select("id")
      .single();
    if (insertError || !payment) throw new Error(`No fue posible registrar el pago: ${insertError?.message ?? "sin respuesta"}`);

    const { data: result, error: rpcError } = await admin.rpc("process_payment_event_transaction", {
      p_provider: "manual",
      p_external_event_id: externalId,
      p_external_payment_id: externalId,
      p_status: "approved",
      p_amount: period.amount_due,
      p_currency: period.subscriptions.currency,
      p_normalized_payload: toJson(normalizedPayload),
    });
    if (rpcError) throw new Error(`No fue posible confirmar el pago: ${rpcError.message}`);

    const parsed = result as { cancelledReminders?: number } | null;
    return { paymentId: payment.id as string, cancelledReminders: parsed?.cancelledReminders ?? 0 };
  }
}

export function createPaymentWorkflow(): PaymentWorkflow {
  return getServerEnv().APP_MODE === "supabase" ? new SupabasePaymentWorkflow() : new MemoryPaymentWorkflow();
}
