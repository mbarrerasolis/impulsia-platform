import { describeDeliveryError, mediaFromStoredMessage } from "@/integrations/whatsapp/webhook";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ConversationWorkspace } from "@/components/conversation-workspace";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = getServerEnv();
  const client = await createSupabaseServerClient();
  const [conversationResult, messagesResult, profilesResult] = await Promise.all([
    client.from("conversations").select("id,profile_name,external_participant_id,status,assigned_to,human_handoff_requested,lead_id,channels(type)").eq("id", id).maybeSingle(),
    client.from("messages").select("id,direction,body,message_type,sent_at,delivery_status,metadata").eq("conversation_id", id).order("sent_at", { ascending: true }),
    client.from("profiles").select("id,display_name,account_id").is("account_id", null).order("display_name"),
  ]);
  if (conversationResult.error) throw new Error(`No fue posible cargar la conversación: ${conversationResult.error.message}`);
  if (!conversationResult.data) notFound();
  if (messagesResult.error) throw new Error(`No fue posible cargar los mensajes: ${messagesResult.error.message}`);
  if (profilesResult.error) throw new Error(`No fue posible cargar responsables: ${profilesResult.error.message}`);

  const conversation = conversationResult.data;
  // El chat del sitio no depende de Meta: la respuesta queda guardada y el visitante la ve en su chat.
  const web = conversation.channels?.type === "web";
  const instagram = conversation.channels?.type === "instagram";
  const sendingEnabled = web
    || (instagram ? Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID) : Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_GRAPH_VERSION));

  return (
    <>
      <Link className="back-link" href="/admin/conversations"><ArrowLeft size={15}/> Volver a conversaciones</Link>
      <div className="admin-title conversation-detail-title">
        <div>
          <h1>{conversation.profile_name ?? (web ? "Visitante del sitio" : instagram ? "Contacto Instagram" : "Contacto WhatsApp")}</h1>
          <p className="muted">{web ? "Chat del sitio" : instagram ? "Mensajes directos de Instagram (24 h para responder desde su último mensaje)" : conversation.external_participant_id ?? "Sin identificador externo"}</p>
        </div>
        <span className={`state ${conversation.human_handoff_requested ? "paused" : "active"}`}>{conversation.status === "closed" ? "Cerrada" : conversation.human_handoff_requested ? "Atención humana" : "Abierta"}</span>
      </div>
      <ConversationWorkspace
        conversationId={conversation.id}
        assignedTo={conversation.assigned_to}
        status={conversation.status}
        messages={(messagesResult.data ?? []).map((message) => ({ id: message.id, direction: message.direction, body: message.body, sentAt: message.sent_at, deliveryStatus: message.delivery_status, deliveryError: describeDeliveryError(message.metadata), ...messageMediaProps(message) }))}
        profiles={(profilesResult.data ?? []).map((profile) => ({ id: profile.id, displayName: profile.display_name }))}
        sendingEnabled={sendingEnabled}
        channelLabel={web ? "el chat del sitio" : instagram ? "Instagram" : "WhatsApp"}
      />
    </>
  );
}

function messageMediaProps(message: { direction: string; message_type: string; metadata: unknown }) {
  if (message.direction === "outbound") return message.message_type === "audio" ? { voiceReply: true } : {};
  const media = mediaFromStoredMessage(message.metadata);
  return media ? { media: { kind: media.kind, ...(media.filename ? { filename: media.filename } : {}) } } : {};
}
