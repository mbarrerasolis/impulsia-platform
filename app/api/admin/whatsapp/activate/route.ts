import { NextResponse } from "next/server";
import { z } from "zod";
import { WhatsAppCloudProvider } from "@/integrations/whatsapp/whatsapp-cloud-provider";
import { ApiAuthorizationError, requireInternalApiRole } from "@/lib/auth/api-authorization";
import { getServerEnv } from "@/lib/env";
import { routeError } from "@/lib/http/route-error";
import { moduleDisabledResponse } from "@/lib/business";

export const runtime = "nodejs";

const activateSchema = z.object({ pin: z.string().regex(/^\d{6}$/, "El PIN debe tener 6 dígitos.") });

function providerOrNull() {
  const env = getServerEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_GRAPH_VERSION) return null;
  return {
    provider: new WhatsAppCloudProvider({ accessToken: env.WHATSAPP_ACCESS_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID, graphVersion: env.WHATSAPP_GRAPH_VERSION }),
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  };
}

/** Errores de Meta se muestran tal cual (no contienen el token) para poder corregirlos desde el panel. */
function metaError(error: unknown) {
  if (error instanceof ApiAuthorizationError || error instanceof z.ZodError) return routeError(error, "whatsapp.activate.failed");
  const message = error instanceof Error ? error.message : "Error inesperado.";
  console.error("whatsapp.activate.failed", { message });
  return NextResponse.json({ error: message }, { status: 502 });
}

/** Estado actual del número en Meta. */
export async function GET() {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  try {
    await requireInternalApiRole(["owner_admin"]);
    const configured = providerOrNull();
    if (!configured) return NextResponse.json({ error: "Faltan WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_GRAPH_VERSION." }, { status: 503 });
    return NextResponse.json({ phone: await configured.provider.phoneNumberStatus() });
  } catch (error) {
    return metaError(error);
  }
}

/** Registra el número en la API de la nube y conecta la cuenta de WhatsApp Business a la app. */
export async function POST(request: Request) {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  try {
    await requireInternalApiRole(["owner_admin"]);
    const { pin } = activateSchema.parse(await request.json());
    const configured = providerOrNull();
    if (!configured) return NextResponse.json({ error: "Faltan WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_GRAPH_VERSION." }, { status: 503 });
    const registered = await configured.provider.registerPhoneNumber(pin);
    const subscribed = configured.businessAccountId ? await configured.provider.subscribeBusinessAccount(configured.businessAccountId) : null;
    return NextResponse.json({ registered, subscribed, phone: await configured.provider.phoneNumberStatus() });
  } catch (error) {
    return metaError(error);
  }
}
