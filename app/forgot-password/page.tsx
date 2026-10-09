import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Recuperar acceso", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  const enabled = process.env.APP_MODE === "supabase";

  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        <div className="auth-shell">
          <div className="container" style={{ display: "grid", placeItems: "center" }}>
            <section className="card" style={{ width: "min(460px,100%)", padding: 35 }}>
              <h1 style={{ marginTop: 0 }}>Recupera tu acceso</h1>
              <p className="muted">
                Ingresa el email asociado a tu cuenta. Si está registrado, recibirás un enlace para definir una nueva contraseña.
              </p>
              <ForgotPasswordForm enabled={enabled} />
              <Link href="/login" style={{ display: "block", textAlign: "center", marginTop: 18, fontSize: 13 }}>
                Volver al ingreso
              </Link>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
