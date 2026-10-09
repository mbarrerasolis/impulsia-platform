import type { Metadata } from "next";
import Link from "next/link";
import { SetPasswordForm } from "@/components/set-password-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBrandConfig } from "@/lib/brand";

export const metadata: Metadata = { title: "Configurar acceso", robots: { index: false, follow: false } };

export default function SetPasswordPage() {
  const brand = getBrandConfig();
  return <div className="page-shell">
    <SiteHeader />
    <main>
      <div className="auth-shell">
        <div className="container" style={{display:"grid",placeItems:"center"}}>
          <section className="card" style={{width:"min(460px,100%)",padding:35}}>
            <h1 style={{marginTop:0}}>Configura tu acceso</h1>
            <p className="muted">Define una contraseña segura para activar o recuperar tu acceso a {brand.name}.</p>
            <SetPasswordForm />
            <Link href="/login" style={{display:"block",textAlign:"center",marginTop:18,fontSize:13}}>Volver al ingreso</Link>
          </section>
        </div>
      </div>
    </main>
    <SiteFooter />
  </div>;
}
