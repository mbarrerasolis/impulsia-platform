import { NextResponse } from "next/server";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateConversation, updateConversationSchema } from "@/services/messaging/manage-conversation";
import { moduleDisabledResponse } from "@/lib/business";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  try {
    const actor = await requireInternalApiRole(["owner_admin", "sales", "support"]);
    const { id } = await params;
    const changes = updateConversationSchema.parse(await request.json());
    const conversation = await updateConversation({
      client: createSupabaseAdminClient(),
      conversationId: id,
      actorId: actor.id,
      changes,
    });
    return NextResponse.json({ conversation });
  } catch (error) {
    return routeError(error, "conversation.update.failed");
  }
}
