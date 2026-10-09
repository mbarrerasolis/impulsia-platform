import { after, NextResponse, type NextRequest } from "next/server";
import { defaultFollowUpRules } from "@/domain/messaging/follow-up";
import { createSalesAssistantRuntime } from "@/integrations/ai";
import { createVoiceProvider } from "@/integrations/audio";
import { createEmailProvider } from "@/integrations/email";
import { InstagramMessagingProvider } from "@/integrations/instagram/instagram-provider";
import { extractInboundInstagramMessages } from "@/integrations/instagram/webhook";
import { verifyWhatsAppSignature } from "@/integrations/whatsapp/webhook";
import { getBrandConfig } from "@/lib/brand";
import { moduleDisabledResponse } from "@/lib/business";
import { getEditionConfig } from "@/lib/edition";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendAssistantAlerts } from "@/services/messaging/assistant-notifications";
import { answerDeferredWhatsApp, instagramChannel, processWhatsAppInbound, type WhatsAppAssistantRuntime, type WhatsAppInboundOutcome } from "@/services/messaging/process-whatsapp-webhook";
import { followUpConversation } from "@/services/messaging/whatsapp-follow-ups";

const maxWebhookBytes = 1_000_000;
export const runtime = "nodejs";
// Igual que WhatsApp: la IA responde después de contestarle a Meta y la función espera el plazo del seguimiento.
export const maxDuration = 300;
const followUpReserveMs = 40_000;

/** Verificación del webhook que hace Meta al configurarlo en la app. */
export function GET(request: NextRequest) {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  const env = getServerEnv();
  const verifyToken = env.INSTAGRAM_VERIFY_TOKEN ?? env.WHATSAPP_VERIFY_TOKEN;
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (!verifyToken) return new NextResponse("Instagram no configurado.", { status: 503 });
  if (mode !== "subscribe" || token !== verifyToken || !challenge) return new NextResponse("Verificación rechazada.", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(request: NextRequest) {
  const disabled = moduleDisabledResponse("whatsapp");
  if (disabled) return disabled;
  const startedAt = Date.now();
  const env = getServerEnv();
  const brand = getBrandConfig();
  // Meta firma con el secreto de la app de Instagram; se acepta también el de la app principal por si es la misma.
  const secrets = [env.INSTAGRAM_APP_SECRET, env.WHATSAPP_APP_SECRET].filter((secret): secret is string => Boolean(secret));
  if (!secrets.length) return NextResponse.json({ error: "Instagram no configurado." }, { status: 503 });
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxWebhookBytes) return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > maxWebhookBytes) return NextResponse.json({ error: "Payload demasiado grande." }, { status: 413 });
  const signature = request.headers.get("x-hub-signature-256");
  if (!secrets.some((secret) => verifyWhatsAppSignature(rawBody, signature, secret))) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const messages = extractInboundInstagramMessages(payload);
  if (!messages.length) return NextResponse.json({ received: true, messages: 0 });

  try {
    const client = createSupabaseAdminClient();
    const botEnabled = env.INSTAGRAM_BOT_ENABLED === "true";
    const provider = env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID
      ? new InstagramMessagingProvider({ accessToken: env.INSTAGRAM_ACCESS_TOKEN, accountId: env.INSTAGRAM_ACCOUNT_ID, graphVersion: env.INSTAGRAM_GRAPH_VERSION })
      : undefined;
    const salesRuntime = botEnabled && provider ? createSalesAssistantRuntime() : null;
    // Instagram sólo acepta audios por URL pública: Claudia entiende las notas de voz pero responde por escrito.
    const assistant: WhatsAppAssistantRuntime | undefined = salesRuntime ? { ...salesRuntime, voice: createVoiceProvider(), voiceReplies: false } : undefined;

    const outcomes: WhatsAppInboundOutcome[] = [];
    const deferred: { message: (typeof messages)[number]; conversationId: string }[] = [];
    for (const message of messages) {
      const profileName = provider ? await provider.profile(message.sender) : null;
      const outcome = await processWhatsAppInbound({
        client,
        message: { ...message, ...(profileName ? { profileName } : {}) },
        botEnabled: botEnabled && Boolean(assistant),
        provider: assistant ? provider : undefined,
        brandName: brand.name,
        assistant,
        channel: instagramChannel,
      });
      if (outcome.deferred) deferred.push({ message: { ...message, ...(profileName ? { profileName } : {}) }, conversationId: outcome.conversationId });
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

    if (assistant && provider && deferred.length) {
      after(async () => {
        const answered = await Promise.all(deferred.map(async ({ message, conversationId }) => {
          try {
            return await answerDeferredWhatsApp({ client, message, conversationId, provider, runtime: assistant, batchMs: env.ASSISTANT_BATCH_SECONDS * 1_000, channel: instagramChannel });
          } catch (error) {
            console.error("instagram.assistant.failed", { conversationId, message: error instanceof Error ? error.message : "unknown" });
            return null;
          }
        }));
        await sendAlerts(answered.filter((outcome): outcome is WhatsAppInboundOutcome => outcome !== null));
      });

      if (env.ASSISTANT_FOLLOW_UP_ENABLED === "true") {
        const targets = [...new Set(deferred.map((item) => item.conversationId))];
        after(async () => {
          const deadline = startedAt + maxDuration * 1_000 - followUpReserveMs;
          const waitMs = Math.min(env.ASSISTANT_FOLLOW_UP_MINUTES * 60_000, deadline - Date.now());
          if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
          for (const conversationId of targets) {
            try {
              await followUpConversation({
                client, provider, conversationId, channel: "instagram",
                assistant: assistant.assistant,
                model: assistant.model,
                dailyBudgetUsd: assistant.limits.dailyBudgetUsd,
                rules: { ...defaultFollowUpRules, delayMinutes: env.ASSISTANT_FOLLOW_UP_MINUTES },
              });
            } catch (error) {
              console.error("instagram.follow_up.failed", { conversationId, message: error instanceof Error ? error.message : "unknown" });
            }
          }
        });
      }
    }
    return NextResponse.json({ received: true, messages: messages.length });
  } catch (error) {
    console.error("instagram.webhook.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No fue posible procesar el evento." }, { status: 500 });
  }
}
