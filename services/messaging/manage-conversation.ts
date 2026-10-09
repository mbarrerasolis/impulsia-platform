import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { toJson } from "@/lib/supabase/json";
import type { Database } from "@/lib/supabase/database.types";

type AppClient = SupabaseClient<Database>;
const internalRoleValues = new Set(["owner_admin", "sales", "technical", "finance", "support"]);

export const updateConversationSchema = z.object({
  assignedTo: z.uuid().nullable().optional(),
  /** bot_qualifying devuelve la conversación al asistente (p. ej. tras resolver un envío fallido). */
  status: z.enum(["waiting_human", "closed", "bot_qualifying"]).optional(),
}).refine((value) => value.assignedTo !== undefined || value.status !== undefined, {
  message: "Debes indicar una asignación o estado.",
});

export const manualMessageSchema = z.object({
  body: z.string().trim().min(1).max(4096),
});

export async function updateConversation(input: {
  client: AppClient;
  conversationId: string;
  actorId: string;
  changes: z.infer<typeof updateConversationSchema>;
}) {
  const changes = updateConversationSchema.parse(input.changes);
  const existing = await input.client.from("conversations").select("*").eq("id", input.conversationId).maybeSingle();
  if (existing.error) throw new Error(`No fue posible consultar la conversación: ${existing.error.message}`);
  if (!existing.data) throw new Error("Conversación no encontrada.");

  if (changes.assignedTo) {
    const assignee = await input.client.from("profiles").select("id,role,account_id").eq("id", changes.assignedTo).maybeSingle();
    if (assignee.error) throw new Error(`No fue posible validar la asignación: ${assignee.error.message}`);
    const assigneeProfile = assignee.data;
    if (!assigneeProfile || assigneeProfile.account_id || !internalRoleValues.has(assigneeProfile.role)) {
      throw new Error("El responsable seleccionado no es un perfil interno válido.");
    }
  }

  const update: Database["public"]["Tables"]["conversations"]["Update"] = {};
  if (changes.assignedTo !== undefined) update.assigned_to = changes.assignedTo;
  if (changes.status) {
    update.status = changes.status;
    update.qualification_state = changes.status === "closed" ? "closed" : changes.status === "bot_qualifying" ? "ai_conversation" : "waiting_human";
    update.human_handoff_requested = changes.status === "waiting_human";
  }

  const saved = await input.client.from("conversations").update(update).eq("id", input.conversationId).select("*").single();
  if (saved.error) throw new Error(`No fue posible actualizar la conversación: ${saved.error.message}`);
  const audit = await input.client.from("audit_log").insert({
    actor_user_id: input.actorId,
    account_id: existing.data.account_id,
    entity_type: "conversation",
    entity_id: input.conversationId,
    action: "conversation.updated",
    before_data: toJson(existing.data),
    after_data: toJson(saved.data),
  });
  if (audit.error) throw new Error(`La conversación se actualizó, pero no fue posible auditarla: ${audit.error.message}`);
  return saved.data;
}

export async function recordManualReply(input: {
  client: AppClient;
  conversationId: string;
  actorId: string;
  body: string;
  externalId: string;
  senderRef: string;
}) {
  const body = manualMessageSchema.parse({ body: input.body }).body;
  const conversation = await input.client.from("conversations").select("*").eq("id", input.conversationId).maybeSingle();
  if (conversation.error) throw new Error(`No fue posible consultar la conversación: ${conversation.error.message}`);
  if (!conversation.data) throw new Error("Conversación no encontrada.");

  const now = new Date().toISOString();
  const message = await input.client.from("messages").insert({
    conversation_id: input.conversationId,
    external_id: input.externalId,
    direction: "outbound",
    sender_ref: input.senderRef,
    body,
    message_type: "text",
    sent_at: now,
    delivery_status: "sent",
    metadata: toJson({ source: "admin", actorId: input.actorId }),
  }).select("id").single();
  if (message.error) throw new Error(`El mensaje fue enviado, pero no pudo guardarse: ${message.error.message}`);

  const updated = await input.client.from("conversations").update({
    assigned_to: conversation.data.assigned_to ?? input.actorId,
    status: "waiting_human",
    qualification_state: "waiting_human",
    human_handoff_requested: true,
    last_message_at: now,
  }).eq("id", input.conversationId);
  if (updated.error) throw new Error(`El mensaje fue enviado, pero la conversación no pudo actualizarse: ${updated.error.message}`);

  const audit = await input.client.from("audit_log").insert({
    actor_user_id: input.actorId,
    account_id: conversation.data.account_id,
    entity_type: "conversation",
    entity_id: input.conversationId,
    action: "conversation.manual_reply_sent",
    before_data: null,
    after_data: toJson({ messageId: message.data.id, externalId: input.externalId }),
  });
  if (audit.error) throw new Error(`El mensaje fue enviado, pero no fue posible auditarlo: ${audit.error.message}`);
}
