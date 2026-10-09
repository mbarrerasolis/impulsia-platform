import { NextResponse } from "next/server";
import { mediaFromStoredMessage } from "@/integrations/whatsapp/webhook";
import { InstagramMessagingProvider } from "@/integrations/instagram/instagram-provider";
import { WhatsAppCloudProvider } from "@/integrations/whatsapp/whatsapp-cloud-provider";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { getServerEnv } from "@/lib/env";
import { routeError } from "@/lib/http/route-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { moduleDisabledResponse } from "@/lib/business";

/** Tope de lo que el panel muestra; WhatsApp admite documentos más grandes, pero no se sirven desde aquí. */
const maxPanelMediaBytes = 25_000_000;

/** Muestra en el panel el archivo original que mandó el cliente (Meta lo guarda unos 30 días). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  try {
    await requireInternalApiRole(["owner_admin", "sales", "support"]);
    const env = getServerEnv();
    const { id, messageId } = await params;
    const client = createSupabaseAdminClient();
    const found = await client.from("messages").select("metadata, direction").eq("id", messageId).eq("conversation_id", id).maybeSingle();
    if (found.error) throw new Error(`No fue posible consultar el mensaje: ${found.error.message}`);
    const media = found.data?.direction === "inbound" ? mediaFromStoredMessage(found.data.metadata) : undefined;
    if (!media) return NextResponse.json({ error: "El mensaje no tiene archivo adjunto." }, { status: 404 });
    // Instagram entrega los adjuntos como URL temporal del CDN de Meta (no requiere token).
    if (media.id.startsWith("https://")) {
      const instagram = new InstagramMessagingProvider({ accessToken: env.INSTAGRAM_ACCESS_TOKEN ?? "", accountId: env.INSTAGRAM_ACCOUNT_ID ?? "", graphVersion: env.INSTAGRAM_GRAPH_VERSION });
      return mediaResponse(await instagram.downloadMedia(media.id, maxPanelMediaBytes), media.filename ?? `adjunto-${media.kind}`);
    }
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_GRAPH_VERSION) {
      return NextResponse.json({ error: "WhatsApp todavía no está conectado." }, { status: 503 });
    }
    const provider = new WhatsAppCloudProvider({ accessToken: env.WHATSAPP_ACCESS_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID, graphVersion: env.WHATSAPP_GRAPH_VERSION });
    return mediaResponse(await provider.downloadMedia(media.id, maxPanelMediaBytes), media.filename ?? `adjunto-${media.kind}`);
  } catch (error) {
    return routeError(error, "admin.conversation.media");
  }
}

function mediaResponse(file: { data: Buffer; mimeType: string }, name: string) {
  const filename = name.replace(/[^\w.\- ]/g, "_");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "content-type": file.mimeType,
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
      // El archivo viene del cliente: no se le permite ejecutar nada en el dominio del panel.
      "content-security-policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
