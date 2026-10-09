import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createPaymentProvider } from "@/integrations/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toJson } from "@/lib/supabase/json";

const MAX_BODY_BYTES = 8_192;

/**
 * Flow POSTea sólo un `token` a urlConfirmation, sin firma propia (ver
 * integrations/payments/flow-payment-provider.ts). handleWebhook vuelve a
 * consultar payment/getStatus con una petición firmada por nosotros, que es
 * la fuente de verdad. Debe responder 200 en menos de 15s.
 */
export async function POST(request: Request) {
  if (getServerEnv().APP_MODE !== "supabase") {
    return NextResponse.json({ error: "Webhook disponible sólo en modo supabase." }, { status: 404 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Cuerpo demasiado grande." }, { status: 413 });
  const token = new URLSearchParams(raw).get("token");
  if (!token) return NextResponse.json({ error: "Falta token." }, { status: 400 });

  try {
    const event = await createPaymentProvider().handleWebhook({ token });
    if (event.status === "pending") return NextResponse.json({ ok: true, status: "pending" });

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("process_payment_event_transaction", {
      p_provider: getServerEnv().PAYMENT_PROVIDER,
      p_external_event_id: event.externalEventId,
      p_external_payment_id: event.externalPaymentId,
      p_status: event.status,
      p_amount: event.amount,
      p_currency: event.currency,
      p_normalized_payload: toJson(event.raw ?? {}),
    });
    if (error) throw new Error(`No fue posible procesar el evento de pago: ${error.message}`);
    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    console.error("payment.webhook.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No fue posible procesar la confirmación." }, { status: 500 });
  }
}
