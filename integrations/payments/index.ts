import { getServerEnv } from "@/lib/env";
import { getBrandConfig } from "@/lib/brand";
import { FlowPaymentProvider } from "./flow-payment-provider";
import { MockPaymentProvider } from "./mock-payment-provider";
import type { PaymentProvider } from "./payment-provider";

const FLOW_BASE_URLS = { sandbox: "https://sandbox.flow.cl/api", production: "https://www.flow.cl/api" } as const;

export function createPaymentProvider(): PaymentProvider {
  const env = getServerEnv();
  const brand = getBrandConfig();
  switch (env.PAYMENT_PROVIDER) {
    case "mock":
      return new MockPaymentProvider();
    case "flow": {
      if (!env.FLOW_API_KEY || !env.FLOW_SECRET_KEY) {
        throw new Error("PAYMENT_PROVIDER=flow requiere FLOW_API_KEY y FLOW_SECRET_KEY.");
      }
      return new FlowPaymentProvider({
        apiKey: env.FLOW_API_KEY,
        secretKey: env.FLOW_SECRET_KEY,
        baseUrl: FLOW_BASE_URLS[env.FLOW_ENVIRONMENT],
        urlConfirmation: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/flow`,
        urlReturn: `${env.NEXT_PUBLIC_APP_URL}/admin/billing`,
        merchantName: brand.name,
      });
    }
    case "mercadopago":
      throw new Error("PAYMENT_PROVIDER=mercadopago aún no tiene adaptador implementado.");
  }
}
