import { after, NextResponse } from "next/server";
import { ZodError } from "zod";
import { verifyTurnstileToken } from "@/integrations/captcha/turnstile";
import { createEmailProvider } from "@/integrations/email";
import { buildMetaWebsiteEvent, parseMarketingSignals, sendMetaEvents } from "@/integrations/meta/conversions-api";
import { getBrandConfig } from "@/lib/brand";
import { getServerEnv } from "@/lib/env";
import { getLeadRepository } from "@/repositories";
import { CreateLeadService, LeadRateLimitError } from "@/services/leads/create-lead";
import { sendLeadNotifications } from "@/services/leads/lead-notifications";
import { detectBotSubmission, splitLeadSubmission } from "@/services/leads/lead-spam-guard";

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 20_000) return NextResponse.json({ error: "La solicitud excede el tamaño permitido." }, { status: 413 });
    const env = getServerEnv();
    const json: unknown = await request.json();
    const { marketing: rawMarketing, ...body } = json && typeof json === "object" && !Array.isArray(json) ? json as Record<string, unknown> : {};
    const { signals, input } = splitLeadSubmission(body);
    const marketing = parseMarketingSignals(rawMarketing);

    const botSignal = detectBotSubmission(signals);
    if (botSignal) {
      // Se responde como si hubiera funcionado para no enseñarle al bot qué lo delató; no se guarda ni se envían correos.
      console.warn("lead.spam.discarded", { reason: botSignal });
      return NextResponse.json({ id: crypto.randomUUID(), scoreBand: "exploratory" }, { status: 201 });
    }

    if (env.TURNSTILE_SECRET_KEY) {
      const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
      const human = signals.captchaToken && await verifyTurnstileToken({ secret: env.TURNSTILE_SECRET_KEY, token: signals.captchaToken, remoteIp });
      if (!human) return NextResponse.json({ error: "No pudimos verificar que eres una persona. Espera a que termine la verificación e intenta nuevamente." }, { status: 400 });
    }

    const lead = await new CreateLeadService(getLeadRepository()).execute(input);
    // El lead ya quedó guardado: los correos se envían después de responder y un fallo no afecta al usuario.
    after(async () => {
      try {
        const brand = getBrandConfig();
        await sendLeadNotifications(lead, createEmailProvider(), { brandName: brand.name, contactEmail: brand.contactEmail, appUrl: env.NEXT_PUBLIC_APP_URL });
      } catch (error) {
        console.error("lead.notification.failed", { leadId: lead.id, message: error instanceof Error ? error.message : "unknown" });
      }
      // Sólo con consentimiento de publicidad; el event_id es el id del lead, igual que en el píxel del navegador.
      if (marketing && env.NEXT_PUBLIC_META_PIXEL_ID && env.META_CAPI_ACCESS_TOKEN) {
        try {
          await sendMetaEvents(
            { pixelId: env.NEXT_PUBLIC_META_PIXEL_ID, accessToken: env.META_CAPI_ACCESS_TOKEN, graphVersion: env.WHATSAPP_GRAPH_VERSION ?? "v26.0", testEventCode: env.META_CAPI_TEST_EVENT_CODE },
            [buildMetaWebsiteEvent({
              eventId: lead.id, eventName: "Lead", email: lead.email, phone: lead.phone, firstName: lead.name, signals: marketing,
              clientIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
              userAgent: request.headers.get("user-agent") ?? undefined,
            })]
          );
        } catch (error) {
          console.error("lead.meta_capi.failed", { leadId: lead.id, message: error instanceof Error ? error.message : "unknown" });
        }
      }
    });
    return NextResponse.json({ id: lead.id, scoreBand: lead.score >= 75 ? "high" : lead.score >= 50 ? "medium" : "exploratory" }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Revisa los campos requeridos antes de continuar.", issues: error.issues.map(({path,message})=>({path,message})) }, { status: 400 });
    if (error instanceof LeadRateLimitError) {
      console.warn("lead.rate_limited", { scope: error.scope });
      const contactEmail = getBrandConfig().contactEmail;
      return NextResponse.json({ error: error.scope === "email"
        ? `Ya recibimos tus solicitudes de hoy y te contactaremos pronto. Si necesitas agregar algo, escríbenos a ${contactEmail}.`
        : `Estamos recibiendo muchas solicitudes en este momento. Intenta en unos minutos o escríbenos a ${contactEmail}.` }, { status: 429 });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
    console.error("lead.create.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No pudimos guardar el diagnóstico. Intenta nuevamente." }, { status: 500 });
  }
}
