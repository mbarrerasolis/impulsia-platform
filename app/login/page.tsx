import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  const enabled = process.env.APP_MODE === "supabase";
  const reason = (await searchParams).reason;

  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        <div className="auth-shell">
          <div className="container" style={{ display: "grid", placeItems: "center" }}>
            <section className="card" style={{ width: "min(430px,100%)", padding: 35 }}>
              <h1 style={{ marginTop: 0 }}>Acceso seguro</h1>
              <p className="muted">
                {enabled
                  ? "Ingresa con la cuenta asignada a tu rol."
                  : "Supabase Auth se habilita con APP_MODE=supabase. En modo demo, usa los accesos de navegación."}
              </p>
              {reason === "session-expired" && (
                <p className="form-error" role="status">
                  Tu sesión anterior ya no era válida y fue eliminada. Ingresa nuevamente.
                </p>
              )}
              <LoginForm enabled={enabled} />
              <Link
                href="/forgot-password"
                style={{ display: "block", textAlign: "center", marginTop: 16, fontSize: 13, fontWeight: 700 }}
              >
                ¿Olvidaste tu contraseña?
              </Link>
              <Link href="/" style={{ display: "block", textAlign: "center", marginTop: 18, fontSize: 13 }}>
                Volver al sitio
              </Link>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
