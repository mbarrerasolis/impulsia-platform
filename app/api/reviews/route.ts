import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { verifyTurnstileToken } from "@/integrations/captcha/turnstile";
import { maxPendingPerHour, reviewSubmissionSchema } from "@/domain/storefront/reviews";
import { moduleDisabledResponse } from "@/lib/business";
import { getServerEnv } from "@/lib/env";
import { getReviewRepository } from "@/repositories";
import { detectBotSubmission, splitLeadSubmission } from "@/services/leads/lead-spam-guard";

/**
 * Reseña enviada desde el sitio. Queda "por revisar": nada se publica sin aprobación en el panel.
 * Mismas defensas que el formulario de contacto: campo trampa, tiempo mínimo, Turnstile si está
 * configurado y un tope de reseñas en espera por hora.
 */
export async function POST(request: Request) {
  const disabled = moduleDisabledResponse("store");
  if (disabled) return disabled;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 6_000) return NextResponse.json({ error: "La reseña es demasiado larga." }, { status: 413 });
    const { signals, input } = splitLeadSubmission(await request.json());
    if (detectBotSubmission(signals)) return NextResponse.json({ received: true }, { status: 201 });

    const env = getServerEnv();
    if (env.TURNSTILE_SECRET_KEY) {
      const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
      const human = signals.captchaToken && await verifyTurnstileToken({ secret: env.TURNSTILE_SECRET_KEY, token: signals.captchaToken, remoteIp });
      if (!human) return NextResponse.json({ error: "No pudimos verificar que eres una persona. Espera a que termine la verificación e intenta nuevamente." }, { status: 400 });
    }

    const submission = reviewSubmissionSchema.parse(input);
    const repository = getReviewRepository();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    if (await repository.countPendingSince(since) >= maxPendingPerHour) {
      console.warn("review.rate_limited");
      return NextResponse.json({ error: "Estamos recibiendo muchas reseñas. Intenta de nuevo en un rato." }, { status: 429 });
    }
    await repository.create(submission);
    return NextResponse.json({ received: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Revisa los campos.", issues: error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
    console.error("review.create.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No pudimos guardar tu reseña. Intenta nuevamente." }, { status: 500 });
  }
}
