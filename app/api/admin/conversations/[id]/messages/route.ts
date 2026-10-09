import { NextResponse } from "next/server";
import { InstagramMessagingProvider } from "@/integrations/instagram/instagram-provider";
import { WhatsAppCloudProvider } from "@/integrations/whatsapp/whatsapp-cloud-provider";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { getServerEnv } from "@/lib/env";
import { routeError } from "@/lib/http/route-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { manualMessageSchema, recordManualReply } from "@/services/messaging/manage-conversation";
import { moduleDisabledResponse } from "@/lib/business";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  try {
    const actor = await requireInternalApiRole(["owner_admin", "sales", "support"]);
    const env = getServerEnv();
    const { id } = await params;
    const { body } = manualMessageSchema.parse(await request.json());
    const client = createSupabaseAdminClient();
    const conversation = await client.from("conversations").select("external_participant_id, channels(type)").eq("id", id).maybeSingle();
    if (conversation.error) throw new Error(`No fue posible consultar la conversación: ${conversation.error.message}`);
    if (!conversation.data?.external_participant_id) throw new Error("Conversación no encontrada o sin destinatario.");

    // Chat del sitio: la respuesta queda guardada y el visitante la ve al consultar su conversación.
    if (conversation.data.channels?.type === "web") {
      const externalId = `web-${crypto.randomUUID()}`;
      await recordManualReply({ client, conversationId: id, actorId: actor.id, body, externalId, senderRef: "site-chat" });
      return NextResponse.json({ ok: true, externalId }, { status: 201 });
    }
    if (conversation.data.channels?.type === "instagram") {
      if (!env.INSTAGRAM_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) return NextResponse.json({ error: "Instagram todavía no está conectado." }, { status: 503 });
      const instagram = new InstagramMessagingProvider({ accessToken: env.INSTAGRAM_ACCESS_TOKEN, accountId: env.INSTAGRAM_ACCOUNT_ID, graphVersion: env.INSTAGRAM_GRAPH_VERSION });
      const externalId = await instagram.sendText(conversation.data.external_participant_id, body);
      await recordManualReply({ client, conversationId: id, actorId: actor.id, body, externalId, senderRef: env.INSTAGRAM_ACCOUNT_ID });
      return NextResponse.json({ ok: true, externalId }, { status: 201 });
    }
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_GRAPH_VERSION) {
      return NextResponse.json({ error: "WhatsApp todavía no está conectado." }, { status: 503 });
    }

    const provider = new WhatsAppCloudProvider({
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      graphVersion: env.WHATSAPP_GRAPH_VERSION,
    });
    const externalId = await provider.sendText(conversation.data.external_participant_id, body);
    await recordManualReply({
      client,
      conversationId: id,
      actorId: actor.id,
      body,
      externalId,
      senderRef: env.WHATSAPP_PHONE_NUMBER_ID,
    });
    return NextResponse.json({ ok: true, externalId }, { status: 201 });
  } catch (error) {
    return routeError(error, "conversation.reply.failed");
  }
}
