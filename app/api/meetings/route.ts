import { after, NextResponse } from "next/server";
import { ZodError } from "zod";
import { formatSlot } from "@/domain/scheduling/slots";
import { createMeetingScheduler } from "@/integrations/calendar";
import { verifyTurnstileToken } from "@/integrations/captcha/turnstile";
import { createEmailProvider } from "@/integrations/email";
import { buildMetaWebsiteEvent, parseMarketingSignals, sendMetaEvents } from "@/integrations/meta/conversions-api";
import { getBrandConfig } from "@/lib/brand";
import { moduleDisabledResponse } from "@/lib/business";
import { getServerEnv } from "@/lib/env";
import { getLeadRepository } from "@/repositories";
import { BookWebMeetingService } from "@/services/leads/book-web-meeting";
import { LeadRateLimitError } from "@/services/leads/create-lead";
import { buildInternalMeetingEmail } from "@/services/leads/lead-notifications";
import { detectBotSubmission, splitLeadSubmission } from "@/services/leads/lead-spam-guard";
import type { MeetingScheduler } from "@/services/messaging/meeting-scheduler";

/** Horarios que muestra la página: todos los libres de los próximos días hábiles. */
const maxWebSlots = 40;

async function availableSlots(scheduler: MeetingScheduler) {
  const slots = await scheduler.listSlots(maxWebSlots, { allPerDay: true });
  return slots.map((start) => ({ start: start.toISOString(), label: formatSlot(start, "es-CL", scheduler.rules.timeZone) }));
}

export async function GET() {
  const disabled = moduleDisabledResponse("meetings");
  if (disabled) return disabled;
  const scheduler = createMeetingScheduler();
  if (!scheduler) return NextResponse.json({ available: false, slots: [] });
  try {
    return NextResponse.json({ available: true, timeZone: scheduler.rules.timeZone, meetingMinutes: scheduler.rules.meetingMinutes, slots: await availableSlots(scheduler) });
  } catch (error) {
    console.error("meeting.slots.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ available: false, slots: [] }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const disabled = moduleDisabledResponse("meetings");
  if (disabled) return disabled;
  const contactEmail = getBrandConfig().contactEmail;
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 20_000) return NextResponse.json({ error: "La solicitud excede el tamaño permitido." }, { status: 413 });
    const scheduler = createMeetingScheduler();
    if (!scheduler) return NextResponse.json({ error: `La agenda en línea no está disponible. Escríbenos a ${contactEmail}.` }, { status: 503 });
    const env = getServerEnv();
    const json: unknown = await request.json();
    const { marketing: rawMarketing, ...body } = json && typeof json === "object" && !Array.isArray(json) ? json as Record<string, unknown> : {};
    const { signals, input } = splitLeadSubmission(body);
    const marketing = parseMarketingSignals(rawMarketing);

    const botSignal = detectBotSubmission(signals);
    if (botSignal) {
      // Igual que en /api/leads: se responde como si funcionara, sin agendar ni avisar.
      console.warn("meeting.spam.discarded", { reason: botSignal });
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (env.TURNSTILE_SECRET_KEY) {
      const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
      const human = signals.captchaToken && await verifyTurnstileToken({ secret: env.TURNSTILE_SECRET_KEY, token: signals.captchaToken, remoteIp });
      if (!human) return NextResponse.json({ error: "No pudimos verificar que eres una persona. Espera a que termine la verificación e intenta nuevamente." }, { status: 400 });
    }

    const result = await new BookWebMeetingService(getLeadRepository(), scheduler).execute(input);
    if (!result.ok) {
      return NextResponse.json({
        error: result.reason === "busy" ? "Ese horario se acaba de ocupar. Elige otro, por favor." : "Ese horario ya no está disponible. Elige otro, por favor.",
        slots: await availableSlots(scheduler).catch(() => []),
      }, { status: 409 });
    }

    const { lead } = result;
    after(async () => {
      try {
        await createEmailProvider().send(buildInternalMeetingEmail(lead, result, { brandName: getBrandConfig().name, contactEmail, appUrl: env.NEXT_PUBLIC_APP_URL }));
      } catch (error) {
        console.error("meeting.notification.failed", { leadId: lead.id, message: error instanceof Error ? error.message : "unknown" });
      }
      if (marketing && env.NEXT_PUBLIC_META_PIXEL_ID && env.META_CAPI_ACCESS_TOKEN) {
        try {
          await sendMetaEvents(
            { pixelId: env.NEXT_PUBLIC_META_PIXEL_ID, accessToken: env.META_CAPI_ACCESS_TOKEN, graphVersion: env.WHATSAPP_GRAPH_VERSION ?? "v26.0", testEventCode: env.META_CAPI_TEST_EVENT_CODE },
            [buildMetaWebsiteEvent({
              eventId: lead.id, eventName: "Schedule", email: lead.email, phone: lead.phone, firstName: lead.name, signals: marketing,
              clientIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
              userAgent: request.headers.get("user-agent") ?? undefined,
            })]
          );
        } catch (error) {
          console.error("meeting.meta_capi.failed", { leadId: lead.id, message: error instanceof Error ? error.message : "unknown" });
        }
      }
    });
    return NextResponse.json({ ok: true, id: lead.id, start: result.start.toISOString(), slotLabel: result.slotLabel, meetLink: result.meetLink }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Revisa los campos antes de continuar.", issues: error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400 });
    if (error instanceof LeadRateLimitError) {
      console.warn("meeting.rate_limited", { scope: error.scope });
      return NextResponse.json({ error: error.scope === "email"
        ? `Ya recibimos tus solicitudes de hoy. Si necesitas cambiar algo, escríbenos a ${contactEmail}.`
        : `Estamos recibiendo muchas solicitudes. Intenta en unos minutos o escríbenos a ${contactEmail}.` }, { status: 429 });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
    console.error("meeting.book.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: `No pudimos agendar. Intenta nuevamente o escríbenos a ${contactEmail}.` }, { status: 500 });
  }
}
