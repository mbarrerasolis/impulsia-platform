import { after, NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseLeadAttribution } from "@/domain/marketing/attribution";
import { createSalesAssistantRuntime } from "@/integrations/ai";
import { createEmailProvider } from "@/integrations/email";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendAssistantAlerts } from "@/services/messaging/assistant-notifications";
import { loadWebChat, processWebChatMessage, webChatMessageSchema, webChatPollSchema } from "@/services/messaging/web-chat";

const unavailable = () => NextResponse.json({ error: "El chat no está disponible en este momento." }, { status: 503 });

/** Mensaje del visitante al asistente del sitio. */
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 8_000) return NextResponse.json({ error: "El mensaje es demasiado largo." }, { status: 413 });
    const env = getServerEnv();
    const runtime = env.APP_MODE === "supabase" ? createSalesAssistantRuntime() : null;
    if (!runtime) return unavailable();
    const raw = await request.json() as Record<string, unknown>;
    // Campo trampa: un bot que lo llena recibe una respuesta vacía y no gasta IA.
    if (typeof raw?.website === "string" && raw.website.trim()) return NextResponse.json({ reply: null });
    const input = webChatMessageSchema.parse(raw);
    const client = createSupabaseAdminClient();
    const { reply, outcome } = await processWebChatMessage({ client, runtime, ...input, attribution: parseLeadAttribution(raw.attribution) });
    after(async () => {
      try {
        const brand = getBrandConfig();
        const edition = getEditionConfig();
        await sendAssistantAlerts(outcome, createEmailProvider(), { brandName: brand.name, contactEmail: brand.contactEmail, appUrl: env.NEXT_PUBLIC_APP_URL, currency: edition.pricing.currency, locale: edition.locale, timeZone: env.ASSISTANT_TIME_ZONE });
      } catch (error) {
        console.error("web_chat.alerts.failed", { message: error instanceof Error ? error.message : "unknown" });
      }
    });
    return NextResponse.json({ reply, waitingHuman: reply === null || Boolean(outcome.handoff) });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
    console.error("web_chat.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No pude responder ahora. Intenta de nuevo en un momento." }, { status: 500 });
  }
}

/** Historial del visitante (y respuestas nuevas del equipo si la conversación la tomó una persona). */
export async function GET(request: Request) {
  try {
    if (getServerEnv().APP_MODE !== "supabase") return unavailable();
    const url = new URL(request.url);
    const input = webChatPollSchema.parse({ visitorId: url.searchParams.get("visitorId"), after: url.searchParams.get("after") ?? undefined });
    const chat = await loadWebChat(createSupabaseAdminClient(), input.visitorId, input.after);
    return NextResponse.json(chat, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    console.error("web_chat.poll.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No fue posible cargar la conversación." }, { status: 500 });
  }
}
