import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseSessionCookieNames } from "@/lib/auth/session-cookies";

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
}

function redirectToLogin(request: NextRequest, response: NextResponse, supabaseUrl: string) {
  const sessionCookies = getSupabaseSessionCookieNames(
    request.cookies.getAll().map(({ name }) => name),
    supabaseUrl,
  );
  const loginUrl = new URL("/login", request.url);
  if (sessionCookies.length) loginUrl.searchParams.set("reason", "session-expired");
  const redirectResponse = NextResponse.redirect(loginUrl);
  copyResponseCookies(response, redirectResponse);
  sessionCookies.forEach((name) => {
    redirectResponse.cookies.set(name, "", { maxAge: 0, path: "/", sameSite: "lax" });
  });
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  if ((process.env.APP_MODE ?? "demo") !== "supabase") return NextResponse.next();
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: (values) => {
      values.forEach(({name,value}) => request.cookies.set(name,value));
      response = NextResponse.next({ request });
      values.forEach(({name,value,options}) => response.cookies.set(name,value,options));
    }
  }});
  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return redirectToLogin(request, response, url);
  } catch (error) {
    console.error("auth.proxy.failed", { message: error instanceof Error ? error.message : "unknown" });
    return redirectToLogin(request, response, url);
  }
  return response;
}

export const config = { matcher: ["/admin/:path*", "/portal/:path*"] };
