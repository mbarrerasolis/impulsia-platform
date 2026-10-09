import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { Illustration, IllustrationSprite, type IllustrationName } from "@/components/landing/illustrations";
import { SaludCapabilities } from "@/components/landing/salud-capabilities";
import { SaludDayTimeline } from "@/components/landing/salud-day-timeline";
import { SaludFlow } from "@/components/landing/salud-flow";
import { SaludHeroPhone } from "@/components/landing/salud-hero-phone";
import { SaludTimeCalculator } from "@/components/landing/salud-time-calculator";
import salesKnowledge from "@/config/sales-knowledge.json";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { formatMoney } from "@/lib/format";
import { socialMetadata } from "@/lib/seo";
import { landingFontClasses } from "../landing-fonts";
import "../landing.css";
import "./salud.css";

const title = "Asistente de WhatsApp que agenda por ti";
const description = "Para profesionales de salud independientes: una asistente responde a tus pacientes por WhatsApp, explica tus servicios, da tarifas, agenda en tu AgendaPro o Google Calendar, cobra y valida pagos, envía recordatorios y arma tu ruta diaria. Lista en 24 horas.";

export function generateMetadata(): Metadata {
  const brand = getBrandConfig();
  return {
    title,
    description,
    alternates: { canonical: "/salud" },
    ...socialMetadata({ title: `${title} | ${brand.name}`, description, path: "/salud" }),
  };
}

const audiences = ["Kinesiología", "Psicología", "Nutrición", "Odontología", "Fonoaudiología", "Terapia ocupacional", "Medicina"];

const beforeAfter = [
  { before: "Contestas WhatsApp entre pacientes, en la micro o de noche.", note: "Y el que no recibe respuesta, agenda en otro lado.", after: "La asistente responde al instante, a cualquier hora." },
  { before: "Revisas la agenda, ofreces horas y anotas a mano.", note: "Con riesgo de topar dos pacientes.", after: "Ofrece sólo tus horas libres y la cita queda en tu AgendaPro o Calendar." },
  { before: "Llamas o escribes uno por uno para confirmar.", note: "Y aun así hay quien no llega.", after: "Recordatorio automático el día antes; confirman con un toque." },
  { before: "Pides la transferencia, esperas el comprobante y lo revisas a mano.", note: "O atiendes sin cobrar la reserva.", after: "Envía el link de pago, confirma cuando entra y revisa los comprobantes por ti." },
  { before: "Te enteras tarde de que alguien canceló.", after: "La cancelación o el cambio de hora quedan registrados al tiro en tu agenda." },
];

const clinicTiles: { icon: IllustrationName; tag: string; title: string; text: string }[] = [
  { icon: "plug", tag: "Laboratorios", title: "Integración con laboratorios", text: "Órdenes, resultados y estados viajan entre tu sistema y el laboratorio con HL7, webhooks o APIs, sin doble digitación." },
  { icon: "database", tag: "Pacientes", title: "Entrega de exámenes en línea", text: "Páginas de postservicio donde el paciente recibe sus resultados de forma simple y segura, sin retiros presenciales." },
  { icon: "chart", tag: "Gestión", title: "Operación y resultados a la vista", text: "Agenda de equipos y operativos, asignación de personal y un panel con los resultados del mes sin armar reportes a mano." },
  { icon: "shield", tag: "Privacidad", title: "Datos cuidados", text: "Acceso por roles, conexiones cifradas y tratamiento de datos alineado con la normativa chilena de protección de datos personales." },
];

/** Los ítems de la oferta están escritos para Claudia ("sus servicios"); en la landing se le habla al profesional. */
function toSecondPerson(text: string) {
  const sentence = text.replace(/\bsus\b/g, "tus").replace(/\bsu\b/g, "tu");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export default function HealthLandingPage() {
  const edition = getEditionConfig();
  const money = (amount: number) => formatMoney(amount, edition.pricing.currency, edition.locale);
  // La misma oferta que cita Claudia: una sola fuente para el precio.
  const offer = salesKnowledge.fixedOffers[0];
  const perDay = money(Math.ceil(offer.monthly / 30 / 100) * 100);
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hola, vengo de la página de salud y quiero una asistente para mi consulta.")}`
    : undefined;
  const steps = [
    { title: "Diagnóstico gratis de 30 minutos", text: "Por Google Meet con Martín, nuestro FDE (a cargo del diagnóstico, la cotización y la implementación). Vemos cómo agendas hoy, qué preguntan tus pacientes y qué agenda usas." },
        { title: "Precio claro desde el inicio", text: `Implementación promocional de ${money(offer.implementation)} + IVA y mensualidad de ${money(offer.monthly)} + IVA, con agenda, recordatorios, pagos, direcciones y ruta diaria incluidos. Si tienes varios profesionales o necesitas integraciones especiales, lo cotizamos en el diagnóstico.` },
        { title: "Tu asistente funcionando en 24 horas", text: "Nos pasas tus servicios, horarios y tarifas; configuramos tu asistente, la probamos contigo y queda atendiendo en tu WhatsApp. Una clínica con varios profesionales toma más días." },
  ];

  return <div className={`lp ${landingFontClasses}`}>
    <IllustrationSprite />
    <SiteHeader />
    <main>
      <header className="lp-hero sl-hero">
        <div className="lp-wrap sl-hero-grid">
          <div className="lp-stack sl-hero-copy">
            <span className="lp-kicker">Para profesionales de salud independientes</span>
            <h1>Mientras atiendes, <span className="lp-mark">tu asistente agenda.</span></h1>
            <p className="lp-lead">Responde a tus pacientes por WhatsApp a cualquier hora: explica tus servicios, da tus tarifas, agenda en tu AgendaPro o Google Calendar, cobra la reserva y valida el pago. También confirma y recuerda.</p>
            <div className="lp-actions">
              <Link className="lp-btn lp-btn-primary" href="/diagnostico">Quiero mi asistente <ArrowRight size={18} /></Link>
              {whatsappHref && <a className="lp-btn lp-btn-ghost" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Escríbenos por WhatsApp</a>}
            </div>
            <ul className="lp-trust">
              <li><Check size={16} strokeWidth={3} /> Lista en 24 horas</li>
              <li><Check size={16} strokeWidth={3} /> Con la agenda que ya usas</li>
              <li><Check size={16} strokeWidth={3} /> Menos de {perDay} al día + IVA</li>
            </ul>
          </div>
          <SaludHeroPhone />
        </div>
      </header>

      <div className="lp-ribbon" aria-label="Para quién es">
        <div className="lp-wrap lp-ribbon-row">{audiences.map((label) => <span key={label}>{label}</span>)}</div>
      </div>

      <section className="lp-band lp-deep" id="como-funciona" aria-labelledby="sl-t-flow">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker lp-kicker-lime">Cómo funciona</span>
            <h2 id="sl-t-flow">De un mensaje a una cita agendada, sin que toques el teléfono.</h2>
          </div>
          <SaludFlow />
        </div>
      </section>

      <section className="lp-band lp-lilac sl-caps-band" aria-labelledby="sl-t-caps">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Mucho más que agendar</span>
            <h2 id="sl-t-caps">Todo lo que resuelve tu asistente.</h2>
            <p className="lp-lead">Lo que hoy te preguntan por WhatsApp una y otra vez, ella lo responde con tu información. Tú decides qué dice y qué te deriva.</p>
          </div>
          <SaludCapabilities />
          <p className="sl-note sl-caps-note">Servicios y montos de ejemplo: tu asistente usa los tuyos.</p>
        </div>
      </section>

      <section className="lp-band" aria-labelledby="sl-t-day">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Un día cualquiera</span>
            <h2 id="sl-t-day">Tus pacientes escriben mientras atiendes.</h2>
            <p className="lp-lead">Si contestas entre una sesión y otra, cada mensaje espera. Y quien escribe de noche, espera hasta mañana o agenda en otro lado.</p>
          </div>
          <div className="lp-sheet sl-day-sheet"><SaludDayTimeline /></div>
        </div>
      </section>

      <section className="lp-band lp-lime" aria-labelledby="sl-t-calc">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">¿Cuánto tiempo se te va?</span>
            <h2 id="sl-t-calc">Las horas que hoy se van en WhatsApp.</h2>
          </div>
          <SaludTimeCalculator />
        </div>
      </section>

      <section className="lp-band" aria-labelledby="sl-t-ab">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Antes y después</span>
            <h2 id="sl-t-ab">Lo que cambia en tu consulta.</h2>
          </div>
          <div className="lp-ab">
            <div className="lp-ab-h">Hoy</div><div aria-hidden="true" /><div className="lp-ab-h">Con tu asistente</div>
            {beforeAfter.map((row) => <div className="lp-ab-row" key={row.before}>
              <div className="lp-ab-before"><span className="lp-ab-tag">Hoy</span>{row.before}{row.note && <small>{row.note}</small>}</div>
              <span className="lp-ab-to" aria-hidden="true"><svg viewBox="0 0 40 24"><path d="M2 12h30M24 4l10 8-10 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div className="lp-ab-after"><span className="lp-ab-tag">Con tu asistente</span>{row.after}</div>
            </div>)}
          </div>
        </div>
      </section>

      <section className="lp-band" id="precio" aria-labelledby="sl-t-price">
        <div className="lp-wrap">
          <div className="lp-pricing lp-sheet">
            <div className="lp-stack">
              <span className="lp-kicker">Precio</span>
              <h2 id="sl-t-price">Tu asistente personalizado por <span className="lp-mark">menos de {perDay} al día.</span></h2>
              <p className="lp-price"><span>mensualidad</span><strong>{money(offer.monthly)}</strong><span>+ IVA</span></p>
              <ul className="lp-checks">{offer.includes.map((item) => <li key={item}><Check size={18} strokeWidth={3} /> {toSecondPerson(item)}</li>)}</ul>
            </div>
            <aside className="lp-tiers sl-price-aside" aria-label="Implementación">
              <span className="lp-kicker lp-kicker-lime">Precio promocional</span>
              <h3>Implementación</h3>
              <strong className="sl-price-big">{money(offer.implementation)} <small>+ IVA</small></strong>
              <p>Pago único. Tu asistente queda funcionando en 24 horas desde que nos pasas tus servicios, horarios y tarifas.</p>
              <div className="lp-actions"><Link className="lp-btn lp-btn-primary" href="/diagnostico">Quiero mi asistente <ArrowRight size={18} /></Link></div>
            </aside>
          </div>
        </div>
      </section>

      <section className="lp-band lp-ink" aria-labelledby="sl-t-steps">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker lp-kicker-lime">Implementación</span>
            <h2 id="sl-t-steps">De la primera conversación a funcionando, en 24 horas.</h2>
          </div>
          <ol className="lp-steps">{steps.map((step) => <li key={step.title}><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
        </div>
      </section>

      <section className="lp-band" aria-labelledby="sl-t-clinics">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Clínicas y laboratorios</span>
            <h2 id="sl-t-clinics">¿Tienes un centro más grande? También.</h2>
            <p className="lp-lead">Integramos lo que ya usas —tu agenda, tu ficha, tu laboratorio, WhatsApp— en vez de obligarte a cambiarlo todo.</p>
          </div>
          <div className="lp-tiles sl-tiles-2">{clinicTiles.map((item) => <article className="lp-tile" key={item.title}>
            <Illustration name={item.icon} size={68} />
            <span className="lp-tag">{item.tag}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>)}</div>
        </div>
      </section>

      <section className="lp-band lp-cta-band sl-cta-band" aria-labelledby="sl-t-cta">
        <div className="lp-wrap">
          <div className="lp-cta lp-sheet">
            <div className="lp-stack">
              <h2 id="sl-t-cta">¿Cuántos pacientes te escribieron hoy mientras atendías?</h2>
              <p className="lp-lead">Cuéntanos cómo agendas hoy y te mostramos cómo funcionaría tu asistente. 30 minutos, gratis y sin compromiso.</p>
            </div>
            <div className="lp-actions">
              <Link href="/agendar" className="lp-btn lp-btn-primary">Agendar diagnóstico gratis <ArrowRight size={18} /></Link>
              {whatsappHref && <a className="lp-btn lp-btn-ghost" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle size={18} /> Escribir por WhatsApp</a>}
            </div>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
