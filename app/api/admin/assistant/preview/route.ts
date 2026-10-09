import { NextResponse } from "next/server";
import { z } from "zod";
import { createSalesAssistantRuntime } from "@/integrations/ai";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { getServerEnv } from "@/lib/env";
import { routeError } from "@/lib/http/route-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAiSpendSince, recordAiUsage } from "@/services/messaging/ai-usage";
import type { AssistantLeadInput } from "@/services/messaging/sales-assistant";
import { moduleDisabledResponse } from "@/lib/business";

export const runtime = "nodejs";
export const maxDuration = 60;

const previewSchema = z.object({
  history: z.array(z.object({ direction: z.enum(["inbound", "outbound"]), body: z.string().max(4_000) })).max(40),
  message: z.string().trim().min(1).max(1_500),
  leadRegistered: z.boolean().default(false),
  quoteProposalsSent: z.number().int().nonnegative().max(10).default(0),
  meetingsScheduled: z.number().int().nonnegative().max(10).default(0),
});

/** Laboratorio del asistente: usa el modelo real, pero no crea leads, no envía propuestas, no agenda reuniones ni envía mensajes. El gasto cuenta para el presupuesto diario. */
export async function POST(request: Request) {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  try {
    await requireInternalApiRole();
    const runtime = createSalesAssistantRuntime();
    if (!runtime) return NextResponse.json({ error: "El asistente con IA no está configurado." }, { status: 503 });
    const input = previewSchema.parse(await request.json());

    const client = getServerEnv().APP_MODE === "supabase" ? createSupabaseAdminClient() : null;
    if (client) {
      const spent = await getAiSpendSince(client, new Date(Date.now() - 24 * 60 * 60_000).toISOString());
      if (spent >= runtime.limits.dailyBudgetUsd) {
        return NextResponse.json({ error: "Se alcanzó el presupuesto diario del asistente con IA." }, { status: 429 });
      }
    }

    let lead: AssistantLeadInput | null = null;
    const result = await runtime.assistant.runTurn({ channel: "preview", history: input.history, message: input.message, profileName: "Lead de prueba", existingLeadId: input.leadRegistered ? "vista-previa" : null, quoteProposalsSent: input.quoteProposalsSent, meetingsScheduled: input.meetingsScheduled }, {
      registerLead: async (data) => { lead = data; return { leadId: "vista-previa" }; },
      requestHandoff: async () => {},
      proposeQuote: async () => {},
      // Consulta horarios reales (sólo lectura) pero nunca crea eventos en el calendario.
      ...(runtime.scheduler ? {
        listMeetingSlots: () => runtime.scheduler!.listSlots(),
        scheduleMeeting: async () => ({ ok: true as const }),
      } : {}),
    });
    if (client) {
      await recordAiUsage(client, { conversationId: null, purpose: "preview", model: runtime.model, usage: result.usage, modelCalls: result.modelCalls, costUsd: result.costUsd });
    }
    return NextResponse.json({ reply: result.reply, lead, handoff: result.handoff, quoteProposal: result.quoteProposal, meeting: result.meeting, costUsd: result.costUsd, modelCalls: result.modelCalls });
  } catch (error) {
    return routeError(error, "assistant.preview.failed");
  }
}
