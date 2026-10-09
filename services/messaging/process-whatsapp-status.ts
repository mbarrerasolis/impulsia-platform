import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhatsAppDeliveryStatus } from "@/integrations/whatsapp/webhook";
import type { Database } from "@/lib/supabase/database.types";
import { toJson } from "@/lib/supabase/json";

type AdminClient = SupabaseClient<Database>;

export async function processWhatsAppDeliveryStatus(input: {
  client: AdminClient;
  status: WhatsAppDeliveryStatus;
}) {
  const existing = await input.client.from("messages")
    .select("conversation_id,metadata")
    .eq("external_id", input.status.externalId)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(`No fue posible buscar el mensaje de WhatsApp: ${existing.error.message}`);
  if (!existing.data) return { matched: false };

  if (input.status.failed) {
    // Sin el motivo no se puede saber si falta el método de pago, el número no existe, etc.
    console.error("whatsapp.delivery.failed", { conversationId: existing.data.conversation_id, recipient: input.status.recipient?.slice(0, 4), ...input.status.error });
  }

  const metadata = existing.data.metadata && typeof existing.data.metadata === "object" && !Array.isArray(existing.data.metadata) ? existing.data.metadata : {};
  const updated = await input.client.from("messages")
    .update({
      delivery_status: input.status.status,
      ...(input.status.failed ? { metadata: toJson({ ...metadata, deliveryError: input.status.error ?? {} }) } : {}),
    })
    .eq("conversation_id", existing.data.conversation_id)
    .eq("external_id", input.status.externalId);
  if (updated.error) throw new Error(`No fue posible actualizar el estado del mensaje: ${updated.error.message}`);

  if (input.status.failed) {
    const handoff = await input.client.from("conversations").update({
      status: "waiting_human",
      qualification_state: "waiting_human",
      human_handoff_requested: true,
    }).eq("id", existing.data.conversation_id);
    if (handoff.error) throw new Error(`No fue posible derivar el envío fallido: ${handoff.error.message}`);
  }

  return { matched: true, conversationId: existing.data.conversation_id };
}
