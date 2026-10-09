import { createHmac } from "node:crypto";
import { z } from "zod";
import type { NormalizedPaymentEvent, PaymentProvider } from "./payment-provider";

/**
 * Adaptador para Flow (developers.flow.cl). Construido sólo con lo documentado
 * oficialmente:
 * - Firma: parámetros ordenados alfabéticamente, concatenados como
 *   "clave1valor1clave2valor2...", HMAC-SHA256 con la secretKey, hex.
 * - payment/create (POST, x-www-form-urlencoded) devuelve {url,token,flowOrder};
 *   la URL de checkout final es `${url}?token=${token}`.
 * - Flow NO firma la notificación a urlConfirmation: sólo envía `token` por
 *   POST. La verificación real ocurre al volver a consultar payment/getStatus
 *   con una petición propia firmada, que es la fuente de verdad del estado.
 *   Por eso este adaptador no valida una firma entrante en handleWebhook.
 */

export const FLOW_STATUS_MAP: Record<number, NormalizedPaymentEvent["status"]> = {
  1: "pending",
  2: "approved",
  3: "rejected",
  4: "cancelled",
};

/** Firma exigida por Flow: claves ordenadas alfabéticamente, concatenadas como "clave1valor1clave2valor2...", HMAC-SHA256 con la secretKey, hex. */
export function signFlowParams(params: Record<string, string | number>, secretKey: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return createHmac("sha256", secretKey).update(toSign).digest("hex");
}

const statusResponseSchema = z.object({
  flowOrder: z.number(),
  commerceOrder: z.string(),
  status: z.number(),
  amount: z.number(),
  currency: z.string(),
  requestDate: z.string().optional(),
});

const createResponseSchema = z.object({
  url: z.string(),
  token: z.string(),
  flowOrder: z.number(),
});

export interface FlowPaymentProviderConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  urlConfirmation: string;
  urlReturn: string;
  merchantName: string;
}

export class FlowPaymentProvider implements PaymentProvider {
  constructor(private readonly config: FlowPaymentProviderConfig) {}

  private async call(path: string, method: "GET" | "POST", params: Record<string, string | number>) {
    const signed = { ...params, apiKey: this.config.apiKey };
    const s = signFlowParams(signed, this.config.secretKey);
    const url = new URL(`${this.config.baseUrl}${path}`);
    let response: Response;
    if (method === "GET") {
      for (const [key, value] of Object.entries({ ...signed, s })) url.searchParams.set(key, String(value));
      response = await fetch(url, { method: "GET" });
    } else {
      const body = new URLSearchParams();
      for (const [key, value] of Object.entries({ ...signed, s })) body.set(key, String(value));
      response = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    }
    const text = await response.text();
    const data = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    })();
    if (!response.ok) {
      const message = typeof data === "object" && data && "message" in data ? String((data as { message: unknown }).message) : text;
      throw new Error(`Flow respondió ${response.status} en ${path}: ${message}`);
    }
    return data;
  }

  async createCustomer(input: { accountId: string }) {
    // Flow no requiere registrar un cliente antes de payment/create; el email
    // se envía junto con cada orden. No hay una llamada real que hacer aquí.
    return { externalCustomerId: `flow_customer_${input.accountId}` };
  }

  async createPaymentLink(input: { billingPeriodId: string; amount: number; currency: string; email?: string; description?: string }) {
    if (!input.email) throw new Error("Flow requiere el email del pagador para crear el link de pago.");
    if (input.currency !== "CLP") throw new Error("Flow en este proyecto sólo está configurado para CLP.");
    const raw = await this.call("/payment/create", "POST", {
      commerceOrder: input.billingPeriodId,
      subject: input.description ?? `Cobranza ${this.config.merchantName} ${input.billingPeriodId}`,
      currency: input.currency,
      amount: Math.round(input.amount),
      email: input.email,
      urlConfirmation: this.config.urlConfirmation,
      urlReturn: this.config.urlReturn,
    });
    const parsed = createResponseSchema.parse(raw);
    return { url: `${parsed.url}?token=${parsed.token}`, externalPaymentId: parsed.token };
  }

  async createOrUpdateSubscription(input: { subscriptionId: string }) {
    // El cobro recurrente de la plataforma es interno (billing_periods generados por
    // approve_quote_transaction); no se delega en el módulo de suscripciones de
    // Flow. Se reserva un id sintético estable por si se integra más adelante.
    return { externalSubscriptionId: `flow_subscription_${input.subscriptionId}` };
  }

  async cancelSubscription() {}

  async getPaymentStatus(externalPaymentId: string): Promise<NormalizedPaymentEvent["status"]> {
    const status = await this.fetchStatus(externalPaymentId);
    return FLOW_STATUS_MAP[status.status] ?? "pending";
  }

  async handleWebhook(payload: unknown): Promise<NormalizedPaymentEvent> {
    const body = z.object({ token: z.string().min(1) }).parse(payload);
    const status = await this.fetchStatus(body.token);
    const mapped = FLOW_STATUS_MAP[status.status] ?? "pending";
    return {
      externalEventId: `${status.flowOrder}-${mapped}`,
      externalPaymentId: body.token,
      status: mapped,
      amount: status.amount,
      currency: status.currency,
      occurredAt: new Date().toISOString(),
      raw: status,
    };
  }

  private async fetchStatus(token: string) {
    const raw = await this.call("/payment/getStatus", "GET", { token });
    return statusResponseSchema.parse(raw);
  }
}
