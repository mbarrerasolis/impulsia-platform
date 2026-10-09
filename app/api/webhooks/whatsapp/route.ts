import { after, NextResponse, type NextRequest } from "next/server";
import { defaultFollowUpRules } from "@/domain/messaging/follow-up";
import { createSalesAssistantRuntime } from "@/integrations/ai";
import { createVoiceProvider } from "@/integrations/audio";
import { createEmailProvider } from "@/integrations/email";
import { extractInboundWhatsAppMessages, extractWhatsAppDeliveryStatuses, verifyWhatsAppSignature } from "@/integrations/whatsapp/webhook";
import { WhatsAppCloudProvider } from "@/integrations/whatsapp/whatsapp-cloud-provider";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendAssistantAlerts } from "@/services/messaging/assistant-notifications";
import { answerDeferredWhatsApp, processWhatsAppInbound, type WhatsAppAssistantRuntime, type WhatsAppInboundOutcome } from "@/services/messaging/process-whatsapp-webhook";
import { processWhatsAppDeliveryStatus } from "@/services/messaging/process-whatsapp-status";
import { followUpConversation } from "@/services/messaging/whatsapp-follow-ups";
import { moduleDisabledResponse } from "@/lib/business";

const maxWebhookBytes = 1_000_000;
export const runtime = "nodejs";
// Una respuesta con IA puede encadenar varias llamadas al modelo, y después la función espera el plazo del seguimiento.
export const maxDuration = 300;
/** Margen para redactar y enviar el seguimiento antes del tope de la función. */
const followUpReserveMs = 40_000;

export function GET(request: NextRequest) {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  const env = getServerEnv();
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (!env.WHATSAPP_VERIFY_TOKEN) return new NextResponse("WhatsApp no configurado.", { status: 503 });
  if (mode !== "subscribe" || token !== env.WHATSAPP_VERIFY_TOKEN || !challenge) {
    return new NextResponse("Verificación rechazada.", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(request: NextRequest) {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  const startedAt = Date.now();
  const env = getServerEnv();
  const brand = getBrandConfig();
  if (!env.WHATSAPP_APP_SECRET) return NextResponse.json({ error: "WhatsApp no configurado." }, { status: 503 });
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxWebhookBytes) return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > maxWebhookBytes) return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), env.WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const messages = extractInboundWhatsAppMessages(payload);
  const statuses = extractWhatsAppDeliveryStatuses(payload);
  if (!messages.length && !statuses.length) return NextResponse.json({ received: true, messages: 0, statuses: 0 });

  try {
    const client = createSupabaseAdminClient();
    const botEnabled = env.WHATSAPP_BOT_ENABLED === "true";
    const provider = botEnabled && env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_GRAPH_VERSION
      ? new WhatsAppCloudProvider({
          accessToken: env.WHATSAPP_ACCESS_TOKEN,
          phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
          graphVersion: env.WHATSAPP_GRAPH_VERSION,
        })
      : undefined;
    const salesRuntime = botEnabled && provider ? createSalesAssistantRuntime() : null;
    const assistant: WhatsAppAssistantRuntime | undefined = salesRuntime
      ? { ...salesRuntime, voice: createVoiceProvider(), voiceReplies: env.ASSISTANT_VOICE_REPLIES === "true" }
      : undefined;
    const outcomes: WhatsAppInboundOutcome[] = [];
    const deferred: { message: (typeof messages)[number]; conversationId: string }[] = [];
    for (const message of messages) {
      const outcome = await processWhatsAppInbound({ client, message, botEnabled, provider, brandName: brand.name, assistant });
      if (outcome.deferred) deferred.push({ message, conversationId: outcome.conversationId });
      else outcomes.push(outcome);
    }

    const sendAlerts = async (list: WhatsAppInboundOutcome[]) => {
      const alerts = list.filter((outcome) => outcome.lead || outcome.quoteProposal || outcome.meeting || outcome.handoff || outcome.budgetWarning);
      if (!alerts.length) return;
      try {
        const email = createEmailProvider();
        const edition = getEditionConfig();
        for (const outcome of alerts) {
          await sendAssistantAlerts(outcome, email, { brandName: brand.name, contactEmail: brand.contactEmail, appUrl: env.NEXT_PUBLIC_APP_URL, currency: edition.pricing.currency, locale: edition.locale, timeZone: env.ASSISTANT_TIME_ZONE });
        }
      } catch (error) {
        console.error("assistant.alert.failed", { message: error instanceof Error ? error.message : "unknown" });
      }
    };
    if (outcomes.length) after(() => sendAlerts(outcomes));

    // La IA responde después de contestarle a Meta: transcribe audios, espera mensajes seguidos y contesta una sola vez.
    if (assistant && provider && deferred.length) {
      after(async () => {
        const answered = await Promise.all(deferred.map(async ({ message, conversationId }) => {
          try {
            return await answerDeferredWhatsApp({ client, message, conversationId, provider, runtime: assistant, batchMs: env.ASSISTANT_BATCH_SECONDS * 1_000 });
          } catch (error) {
            console.error("whatsapp.assistant.failed", { conversationId, message: error instanceof Error ? error.message : "unknown" });
            return null;
          }
        }));
        await sendAlerts(answered.filter((outcome): outcome is WhatsAppInboundOutcome => outcome !== null));
      });
    }
    const followUpTargets = assistant && provider && env.ASSISTANT_FOLLOW_UP_ENABLED === "true"
      ? [...new Set(deferred.map((item) => item.conversationId))]
      : [];
    if (assistant && provider && followUpTargets.length) {
      // Sin cron: la misma función espera el plazo y revisa si el cliente contestó; las reglas descartan lo que ya no aplica.
      after(async () => {
        const deadline = startedAt + maxDuration * 1_000 - followUpReserveMs;
        const waitMs = Math.min(env.ASSISTANT_FOLLOW_UP_MINUTES * 60_000, deadline - Date.now());
        if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
        for (const conversationId of followUpTargets) {
          try {
            const outcome = await followUpConversation({
              client, provider, conversationId,
              assistant: assistant.assistant,
              model: assistant.model,
              dailyBudgetUsd: assistant.limits.dailyBudgetUsd,
              rules: { ...defaultFollowUpRules, delayMinutes: env.ASSISTANT_FOLLOW_UP_MINUTES },
            });
            if (outcome === "sent" || outcome === "budget") console.info("whatsapp.follow_up", { conversationId, outcome });
          } catch (error) {
            console.error("whatsapp.follow_up.failed", { conversationId, message: error instanceof Error ? error.message : "unknown" });
          }
        }
      });
    }
    for (const status of statuses) {
      await processWhatsAppDeliveryStatus({ client, status });
    }
    return NextResponse.json({ received: true, messages: messages.length, statuses: statuses.length });
  } catch (error) {
    console.error("whatsapp.webhook.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No fue posible procesar el evento." }, { status: 500 });
  }
}
