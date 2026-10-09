import type { Metadata } from "next";
import { MeetingBooking } from "@/components/meeting-booking";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBrandConfig } from "@/lib/brand";
import { requireModule } from "@/lib/business";
import { socialMetadata } from "@/lib/seo";
import { landingFontClasses } from "../landing-fonts";
import "../landing.css";
import "./agendar.css";

const title = "Agenda una videollamada";
const description = "Elige un horario libre y conversemos 30 minutos por Google Meet, sin costo ni compromiso: sales con ideas concretas, un camino posible y un rango de costo.";

export function generateMetadata(): Metadata {
  const brand = getBrandConfig();
  return {
    title,
    description,
    alternates: { canonical: "/agendar" },
    ...socialMetadata({ title: `${title} | ${brand.name}`, description, path: "/agendar" }),
  };
}

/** Texto corto y de una línea desde la URL (p. ej. `?negocio=` en un correo); lo demás se ignora. */
function prefill(value: string | string[] | undefined, max: number) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, max) : "";
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  requireModule("meetings");
  const params = await searchParams;
  const brand = getBrandConfig();
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hola, quiero agendar una reunión con Martín.")}` : undefined;
  return <div className={`lp ${landingFontClasses}`}>
    <SiteHeader/>
    <main>
      <header className="lp-page-hero"><div className="lp-wrap lp-stack">
        <span className="lp-kicker">30 minutos · Google Meet · sin costo</span>
        <h1>{title}</h1>
        <p className="lp-lead">Conversas con Martín, nuestro FDE, a cargo del diagnóstico, la cotización y la implementación. Sales con ideas concretas para tu negocio, un camino posible y un rango de costo.</p>
      </div></header>
      <section className="lp-wrap lp-page-body"><div className="lp-form">
        <MeetingBooking
          contactHref={brand.contactHref}
          whatsappHref={whatsappHref}
          turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
          defaultCompany={prefill(params.negocio, 140)}
          defaultTopic={prefill(params.tema, 300)}
        />
      </div></section>
    </main>
    <SiteFooter/>
  </div>;
}
