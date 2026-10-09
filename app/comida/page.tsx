import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, Check, ClipboardList, CreditCard, MessageCircle, Sparkles, Store, type LucideIcon } from "lucide-react";
import { ComidaHeroPhone } from "@/components/landing/comida-hero-phone";
import { ComidaMenuDemo } from "@/components/landing/comida-menu-demo";
import { WhatsAppRefLink } from "@/components/landing/whatsapp-ref-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import salesKnowledge from "@/config/sales-knowledge.json";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { formatMoney } from "@/lib/format";
import { socialMetadata } from "@/lib/seo";
import { landingFontClasses } from "../landing-fonts";
import "../landing.css";
import "../salud/salud.css";
import "./comida.css";

const title = "Menú digital y pedidos por WhatsApp";
const description = "Para locales de comida rápida y delivery: menú digital en el teléfono y un agente de WhatsApp que responde dudas, arma el pedido y pide la dirección. Tu equipo revisa el pago y despacha. Listo en 3 días hábiles.";

export function generateMetadata(): Metadata {
  const brand = getBrandConfig();
  return {
    title,
    description,
    alternates: { canonical: "/comida" },
    ...socialMetadata({ title: `${title} | ${brand.name}`, description, path: "/comida" }),
  };
}

const audiences = ["Hamburguesas", "Pizzas", "Sushi", "Completos y sándwiches", "Pollo", "Comida árabe", "Delivery"];

const flow: { icon: LucideIcon; title: string; text: string; when: string }[] = [
  { icon: Store, title: "Ve tu menú", text: "Desde el enlace de tu Instagram o WhatsApp, con fotos y precios al día.", when: "en el teléfono" },
  { icon: MessageCircle, title: "Pide por WhatsApp", text: "El pedido llega armado desde el menú o lo dicta en el chat.", when: "a cualquier hora" },
  { icon: Sparkles, title: "El agente lo ordena", text: "Responde dudas, confirma productos, despacho o retiro y dirección.", when: "al instante" },
  { icon: CreditCard, title: "Tú revisas el pago", text: "Transferencia o link: tu equipo confirma antes de preparar.", when: "tú decides" },
  { icon: BellRing, title: "A preparar", text: "Pedido completo y claro, sin idas y vueltas en el chat.", when: "listo" },
];

const beforeAfter = [
  { before: "En hora punta el WhatsApp explota y alguien deja de cocinar para contestar.", note: "Y los que esperan, piden en otro lado.", after: "El agente responde al tiro y arma el pedido mientras tu equipo cocina." },
  { before: "\"¿Tienen vegetariana?\", \"¿Hasta qué hora?\", \"¿Llegan a mi comuna?\"", note: "Las mismas preguntas, todos los días.", after: "Las responde con tu menú, tus horarios y tus zonas de despacho." },
  { before: "El pedido llega en cinco mensajes y hay que reconstruirlo.", note: "Con riesgo de errores en la dirección o el producto.", after: "Llega completo: productos, total, despacho o retiro y dirección." },
  { before: "El menú es una foto o un PDF que hay que reenviar y actualizar a mano.", after: "Menú digital en un enlace, fácil de actualizar cuando cambian precios." },
];

/** Rubro del menú de muestra desde `?rubro=` (la categoría del prospecto en el correo, p. ej. "Pizzería"). */
function menuRubro(value: string) {
  const text = value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const match = [["pizz", "pizza"], ["sushi", "sushi"], ["complet", "completos"], ["sandw", "completos"], ["pollo", "pollo"], ["arabe", "arabe"], ["shawarma", "arabe"]].find(([key]) => text.includes(key));
  return match?.[1] ?? "hamburguesa";
}

// Sólo hechos de config/sales-knowledge.json (condiciones del Plan Local y objeciones).
const faqs = [
  { q: "¿Necesito saber de tecnología?", a: "No. Nos pasas tu menú en una planilla (productos, precios, horarios, zonas y medios de pago) y nosotros dejamos todo funcionando. Lo probamos contigo antes de abrirlo a tus clientes." },
  { q: "¿Y si el agente se equivoca o un cliente reclama?", a: "Los reclamos, cambios de pedido y casos especiales te los deriva a una persona, y puedes tomar cualquier conversación cuando quieras. El pago siempre lo confirma tu equipo: el agente nunca lo da por recibido." },
  { q: "¿Puedo seguir usando mi número de WhatsApp?", a: "Sí, el agente trabaja sobre el WhatsApp Business del local. Si hoy usas ese número en la app del teléfono, en la demo revisamos cómo dejar ambos funcionando a la vez." },
  { q: "¿Hay otros costos además de la mensualidad?", a: "Meta cobra cada mensaje de WhatsApp (desde octubre de 2026, unos USD 0,02 por respuesta en Chile) y lo pagas directo a Meta con tu tarjeta. El menú queda en una dirección nuestra; un dominio propio (.cl, unos $12.000 al año) es opcional." },
  { q: "¿Qué pasa si paso de 800 conversaciones al mes?", a: "Se suman bloques de 100 conversaciones a $14.990 + IVA, y te avisamos al llegar al 80 % para que nunca te tome por sorpresa." },
];

/** Los ítems de la oferta están escritos para Claudia ("el local"); en la landing se le habla al dueño. */
function toSecondPerson(text: string) {
  const sentence = text.replace(/\bel local\b/g, "tu equipo");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** Texto corto y de una línea desde la URL (`?negocio=` en un correo); lo demás se ignora. */
function prefill(value: string | string[] | undefined, max: number) {
  return typeof value === "string" ? value.replace(/[\r\n[\]]+/g, " ").trim().slice(0, max) : "";
}

export default async function FoodLandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const negocio = prefill(params.negocio, 80);
  const rubro = menuRubro(prefill(params.rubro, 40));
  const edition = getEditionConfig();
  const money = (amount: number) => formatMoney(amount, edition.pricing.currency, edition.locale);
  // La misma oferta que cita Claudia: una sola fuente para el precio.
  const offer = salesKnowledge.fixedOffers.find((item) => item.name.startsWith("Plan Local"));
  const perDay = offer ? money(Math.ceil(offer.monthly / 30 / 100) * 100) : undefined;
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const whatsappText = `Hola, vengo de la demostración${negocio ? ` para ${negocio}` : " de menú y pedidos"}. Quiero saber cómo funcionaría el menú y el agente de pedidos.`;
  const scheduleHref = { pathname: "/agendar", query: { ...(negocio ? { negocio } : {}), tema: "Menú digital y pedidos por WhatsApp para mi local" } } as const;
  const steps = [
    { title: "Demo de 30 minutos", text: "Por Google Meet con Martín, nuestro FDE. Vemos cómo te piden hoy, qué preguntan tus clientes y cómo despachas." },
    { title: "Nos pasas tu menú", text: "Una planilla con productos, precios y categorías (fotos opcionales), horarios, zonas y costos de despacho, y medios de pago." },
    { title: "Funcionando en 3 días hábiles", text: "Desde que tenemos el menú, tu cuenta de WhatsApp Business lista y tu aprobación. Lo probamos contigo antes de abrirlo a tus clientes." },
  ];

  return <div className={`lp ${landingFontClasses}`}>
    <SiteHeader cta={{ href: scheduleHref, label: "Agendar demo" }} focused />
    <main>
      <header className="lp-hero sl-hero cm-hero">
        <div className="lp-wrap sl-hero-grid">
          <div className="lp-stack sl-hero-copy">
            <span className="lp-kicker">{negocio ? `Una idea para ${negocio}` : "Para locales de comida rápida y delivery"}</span>
            <h1>En hora punta, <span className="lp-mark">tu WhatsApp toma los pedidos.</span></h1>
            <p className="lp-lead">Menú digital en el teléfono y un agente de WhatsApp que responde las preguntas de siempre, arma el pedido y pide la dirección. Tu equipo revisa el pago y despacha.</p>
            <div className="lp-actions">
              <Link className="lp-btn lp-btn-primary" href={scheduleHref}>Agendar demo de 30 min <ArrowRight size={18} /></Link>
              {whatsappNumber && <WhatsAppRefLink className="lp-btn lp-btn-ghost" number={whatsappNumber} text={whatsappText}><MessageCircle size={18} /> Escríbenos por WhatsApp</WhatsAppRefLink>}
            </div>
            <ul className="lp-trust">
              <li><Check size={16} strokeWidth={3} /> Listo en 3 días hábiles</li>
              <li><Check size={16} strokeWidth={3} /> Tú controlas pago y despacho</li>
              {perDay && <li><Check size={16} strokeWidth={3} /> Menos de {perDay} al día + IVA</li>}
            </ul>
          </div>
          <ComidaHeroPhone />
        </div>
      </header>

      <section className="lp-band cm-demo-band" id="demo" aria-labelledby="cm-t-demo">
        <div className="lp-wrap cm-demo-grid">
          <div className="lp-stack">
            <span className="lp-kicker">Pruébalo aquí mismo</span>
            <h2 id="cm-t-demo">Así se vería el menú de <span className="lp-mark">{negocio || "tu local"}.</span></h2>
            <p className="lp-lead">Arma un pedido como lo haría tu cliente y mira cómo te llega a WhatsApp: completo, con total y dirección.</p>
            <ol className="cm-demo-steps">
              <li><b>1</b> Tu cliente abre el menú desde tu Instagram o WhatsApp.</li>
              <li><b>2</b> Elige, toca &quot;Pedir&quot; y el pedido llega armado al chat.</li>
              <li><b>3</b> El agente pide despacho o retiro y dirección. Tu equipo confirma el pago y prepara.</li>
            </ol>
            <div className="lp-actions"><Link className="lp-btn lp-btn-primary" href={scheduleHref}>Verlo con mi menú real <ArrowRight size={18} /></Link></div>
            <p className="cm-fine">Productos y precios de muestra. En la demo de 30 minutos lo vemos con los tuyos.</p>
          </div>
          <ComidaMenuDemo negocio={negocio || "Tu local"} rubro={rubro} />
        </div>
      </section>

      <div className="lp-ribbon" aria-label="Para quién es">
        <div className="lp-wrap lp-ribbon-row">{audiences.map((label) => <span key={label}>{label}</span>)}</div>
      </div>

      <section className="lp-band lp-deep" id="como-funciona" aria-labelledby="cm-t-flow">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker lp-kicker-lime">Cómo funciona</span>
            <h2 id="cm-t-flow">Del menú al pedido listo para preparar.</h2>
          </div>
          <ol className="sl-flow">{flow.map(({ icon: Icon, title: stepTitle, text, when }, index) => <li key={stepTitle} style={{ animationDelay: `${index * 120}ms` }}>
            <span className="sl-flow-icon"><Icon size={30} strokeWidth={2.4} /></span>
            <span className="sl-flow-when">{when}</span>
            <h3>{stepTitle}</h3>
            <p>{text}</p>
          </li>)}</ol>
        </div>
      </section>

      <section className="lp-band" aria-labelledby="cm-t-ab">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Antes y después</span>
            <h2 id="cm-t-ab">Lo que cambia en tu local.</h2>
          </div>
          <div className="lp-ab">
            <div className="lp-ab-h">Hoy</div><div aria-hidden="true" /><div className="lp-ab-h">Con tu agente</div>
            {beforeAfter.map((row) => <div className="lp-ab-row" key={row.before}>
              <div className="lp-ab-before"><span className="lp-ab-tag">Hoy</span>{row.before}{row.note && <small>{row.note}</small>}</div>
              <span className="lp-ab-to" aria-hidden="true"><svg viewBox="0 0 40 24"><path d="M2 12h30M24 4l10 8-10 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div className="lp-ab-after"><span className="lp-ab-tag">Con tu agente</span>{row.after}</div>
            </div>)}
          </div>
        </div>
      </section>

      <section className="lp-band lp-lilac" aria-labelledby="cm-t-honest">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Sin letra chica</span>
            <h2 id="cm-t-honest">Qué hace el agente y qué queda en tus manos.</h2>
          </div>
          <div className="cm-honest">
            <article><h3><ClipboardList size={22} /> Lo hace el agente</h3><ul>
              <li>Responde dudas del menú, horarios y zonas de despacho.</li>
              <li>Arma el pedido con tus precios y calcula el total.</li>
              <li>Pide despacho o retiro, dirección y medio de pago.</li>
              <li>Lee fotos de comprobantes y te las deja para revisar.</li>
            </ul></article>
            <article><h3><Store size={22} /> Lo decide tu equipo</h3><ul>
              <li>Confirmar el pago: el agente nunca lo da por recibido.</li>
              <li>Reclamos, cambios de pedido y casos especiales: te los deriva.</li>
              <li>Puedes tomar cualquier conversación cuando quieras.</li>
              <li>No prometemos más ventas: prometemos menos trabajo repetitivo y pedidos ordenados.</li>
            </ul></article>
          </div>
        </div>
      </section>

      {offer && <section className="lp-band" id="precio" aria-labelledby="cm-t-price">
        <div className="lp-wrap">
          <div className="lp-pricing lp-sheet">
            <div className="lp-stack">
              <span className="lp-kicker">Precio</span>
              <h2 id="cm-t-price">Tu menú y tu agente de pedidos por <span className="lp-mark">menos de {perDay} al día.</span></h2>
              <p className="lp-price"><span>mensualidad</span><strong>{money(offer.monthly)}</strong><span>+ IVA</span></p>
              <ul className="lp-checks">{offer.includes.map((item) => <li key={item}><Check size={18} strokeWidth={3} /> {toSecondPerson(item)}</li>)}</ul>
              <p className="cm-fine">Sobre 800 conversaciones al mes se suman bloques de 100 a $14.990 + IVA (te avisamos al llegar al 80 %). Los cobros de Meta por cada mensaje de WhatsApp (desde octubre de 2026, unos USD 0,02 por respuesta en Chile) se pagan directo a Meta desde tu cuenta. Incluye una dirección en nuestro dominio; tu dominio propio es opcional.</p>
            </div>
            <aside className="lp-tiers sl-price-aside" aria-label="Implementación">
              <span className="lp-kicker lp-kicker-lime">Precio de lanzamiento</span>
              <h3>Implementación</h3>
              <strong className="sl-price-big">{money(offer.implementation)} <small>+ IVA</small></strong>
              <p>Pago único. Funcionando en 3 días hábiles desde que tenemos tu menú, tu WhatsApp Business listo y tu aprobación.</p>
              <div className="lp-actions"><Link className="lp-btn lp-btn-primary" href={scheduleHref}>Agendar demo <ArrowRight size={18} /></Link></div>
            </aside>
          </div>
        </div>
      </section>}

      <section className="lp-band lp-ink" aria-labelledby="cm-t-steps">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker lp-kicker-lime">Implementación</span>
            <h2 id="cm-t-steps">De la demo a recibir pedidos, en 3 días hábiles.</h2>
          </div>
          <ol className="lp-steps">{steps.map((step) => <li key={step.title}><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
        </div>
      </section>

      <section className="lp-band" aria-labelledby="cm-t-faq">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Preguntas frecuentes</span>
            <h2 id="cm-t-faq">Lo que nos preguntan antes de partir.</h2>
          </div>
          <div className="cm-faq">{faqs.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
        </div>
      </section>

      <section className="lp-band lp-cta-band sl-cta-band" aria-labelledby="cm-t-cta">
        <div className="lp-wrap">
          <div className="lp-cta lp-sheet">
            <div className="lp-stack">
              <h2 id="cm-t-cta">¿Cuántos pedidos se quedaron esperando respuesta el último viernes?</h2>
              <p className="lp-lead">Te mostramos cómo funcionaría con tu menú. 30 minutos por Google Meet, gratis y sin compromiso.</p>
            </div>
            <div className="lp-actions">
              <Link href={scheduleHref} className="lp-btn lp-btn-primary">Agendar demo de 30 min <ArrowRight size={18} /></Link>
              {whatsappNumber && <WhatsAppRefLink className="lp-btn lp-btn-ghost" number={whatsappNumber} text={whatsappText}><MessageCircle size={18} /> Escribir por WhatsApp</WhatsAppRefLink>}
            </div>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
