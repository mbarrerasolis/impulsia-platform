import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseSessionCookieNames } from "@/lib/auth/session-cookies";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const env = getServerEnv();
  const cookieStore = await cookies();

  if (env.APP_MODE === "supabase" && env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const client = await createSupabaseServerClient();
      await client.auth.signOut({ scope: "local" });
    } catch (error) {
      console.error("auth.logout.failed", {
        message: error instanceof Error ? error.message : "unknown",
      });
    }

    const sessionCookies = getSupabaseSessionCookieNames(
      cookieStore.getAll().map(({ name }) => name),
      env.NEXT_PUBLIC_SUPABASE_URL,
    );
    sessionCookies.forEach((name) => {
      cookieStore.set(name, "", { maxAge: 0, path: "/", sameSite: "lax" });
    });
  }

  return NextResponse.json({ redirectTo: "/login" });
}
