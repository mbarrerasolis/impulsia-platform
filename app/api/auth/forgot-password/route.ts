import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { getPasswordResetRedirectUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({ email: z.email() });
const successMessage = "Si el email está registrado, recibirás un enlace para recuperar tu acceso.";

export async function POST(request: Request) {
  try {
    if (getServerEnv().APP_MODE !== "supabase") {
      return NextResponse.json({ error: "La recuperación real está deshabilitada en modo demo." }, { status: 409 });
    }

    const { email } = requestSchema.parse(await request.json());
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirectUrl().toString(),
    });

    if (error) {
      console.error("auth.password_reset.failed", { code: error.code, status: error.status });
      const isRateLimited = error.status === 429;
      return NextResponse.json(
        { error: isRateLimited ? "Espera unos minutos antes de solicitar otro enlace." : "No fue posible enviar el enlace. Inténtalo nuevamente." },
        { status: isRateLimited ? 429 : 503 },
      );
    }

    return NextResponse.json({ message: successMessage });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ingresa un email válido." }, { status: 400 });
    }
    console.error("auth.password_reset.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No fue posible solicitar la recuperación." }, { status: 500 });
  }
}
