import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getEditionConfig } from "@/lib/edition";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NotFound() {
  const edition = getEditionConfig();
  return <div className="page-shell"><SiteHeader/><main>
    <section className="simple-hero not-found"><div className="container">
      <span className="eyebrow"><span className="dot"/> Error 404</span>
      <h1>No encontramos esta página.</h1>
      <p className="hero-copy">Puede que el enlace esté mal escrito o que la página ya no exista. Desde aquí puedes volver al inicio o contarnos directamente qué proceso quieres mejorar.</p>
      <div className="hero-actions">
        <Link className="btn btn-primary" href="/diagnostico">{edition.landing.primaryCtaLabel} <ArrowRight size={17}/></Link>
        <Link className="btn btn-secondary" href="/">Volver al inicio</Link>
      </div>
    </div></section>
  </main><SiteFooter/></div>;
}
