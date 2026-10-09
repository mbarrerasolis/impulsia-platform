import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { AuthSetupRedirect } from "@/components/auth-setup-redirect";
import { Carousel } from "@/components/carousel";
import { Illustration, IllustrationSprite, type IllustrationName } from "@/components/landing/illustrations";
import { SalesCycleFigure } from "@/components/landing/sales-cycle";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { formatMoney } from "@/lib/format";
import { isModuleEnabled } from "@/lib/business";
import { getStorefront } from "@/lib/storefront";
import { StoreHome } from "@/components/storefront/store-home";
import { landingFontClasses } from "./landing-fonts";
import "./landing.css";
import "./storefront.css";

const capabilityIllustrations: IllustrationName[] = ["gears", "plug", "bot", "database", "chart", "shield"];

/** Marca en verde la parte destacada de una frase, si aparece en ella. */
function highlightPhrase(text: string, highlight?: string) {
  const start = highlight ? text.indexOf(highlight) : -1;
  if (!highlight || start < 0) return text;
  return <>{text.slice(0, start)}<span className="lp-mark">{highlight}</span>{text.slice(start + highlight.length)}</>;
}

/** La vitrina muestra reseñas aprobadas: se regenera cada 5 minutos (y al moderar, al tiro). */
export const revalidate = 300;

export function generateMetadata(): Metadata {
  return { alternates: { canonical: "/" } };
}

export default function HomePage() {
  // Ediciones que venden productos: la portada es la vitrina con el catálogo.
  const storefront = getStorefront();
  if (storefront) return <StoreHome storefront={storefront} />;
  const brand = getBrandConfig();
  const edition = getEditionConfig();
  const { landing } = edition;
  const money = (amount: number) => formatMoney(amount, edition.pricing.currency, edition.locale);
  const interpolate = (text: string) => text
    .replaceAll("{minimumImplementation}", money(edition.pricing.minimumImplementation))
    .replaceAll("{minimumMaintenance}", money(edition.pricing.minimumMaintenance));
  const productHost = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").host;
  const secondaryCta = landing.secondaryCtaTarget === "diagnostic"
    ? <Link className="lp-btn lp-btn-ghost" href="/diagnostico">{landing.secondaryCtaLabel}</Link>
    : <a className="lp-btn lp-btn-ghost" href={brand.contactHref}>{landing.secondaryCtaLabel}</a>;

  return <div className={`lp ${landingFontClasses}`}>
    <AuthSetupRedirect />
    <IllustrationSprite />
    <SiteHeader />
    <main>
      <header className="lp-hero">
        <div className="lp-wrap">
          <div className="lp-hero-top">
            <div className="lp-stack lp-hero-title">
              <span className="lp-kicker">{brand.heroEyebrow}</span>
              <h1>{brand.heroTitle} <span className="lp-mark">{brand.heroHighlight}</span></h1>
            </div>
            <p className="lp-lead">{brand.heroDescription}</p>
            <div className="lp-stack lp-hero-cta">
              <div className="lp-actions">
                <Link className="lp-btn lp-btn-primary" href="/diagnostico">{landing.primaryCtaLabel} <ArrowRight size={18} /></Link>
                {secondaryCta}
              </div>
              <ul className="lp-trust">{landing.trustItems.map((item) => <li key={item}><Check size={16} strokeWidth={3} /> {interpolate(item)}</li>)}</ul>
            </div>
          </div>
          {landing.salesCycle && <SalesCycleFigure cycle={landing.salesCycle} />}
        </div>
      </header>

      <div className="lp-ribbon" aria-label="Lo que conectamos">
        <div className="lp-wrap lp-ribbon-row">{landing.audienceLabels.map((label) => <span key={label}>{label}</span>)}</div>
      </div>

      {landing.manifesto && <section className="lp-band lp-manifesto" aria-label="Lo que hacemos">
        <div className="lp-wrap">
          <p className="lp-manifesto-lead">{landing.manifesto.lead}</p>
          <p className="lp-manifesto-statement">{highlightPhrase(landing.manifesto.statement, landing.manifesto.highlight)}</p>
          {landing.manifesto.text && <p className="lp-lead">{landing.manifesto.text}</p>}
        </div>
      </section>}

      {landing.assistantDemo && <section className="lp-band lp-deep" id="asistente" aria-labelledby="lp-t-assistant">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker lp-kicker-lime">{landing.assistantDemo.eyebrow}</span>
            <h2 id="lp-t-assistant">{landing.assistantDemo.title}</h2>
            <p className="lp-lead">{landing.assistantDemo.description}</p>
          </div>
          <div className="lp-convo" aria-label="Ejemplo de conversación y lo que el asistente hace en el sistema">
            <div className="lp-convo-h">La conversación</div><div aria-hidden="true" /><div className="lp-convo-h lp-convo-h-sys">Lo que pasa en tu sistema</div>
            {landing.assistantDemo.exchanges.map((exchange) => <div className="lp-convo-row" key={exchange.text}>
              <p className={`lp-msg ${exchange.from === "customer" ? "lp-msg-in" : "lp-msg-out"}`}><small>{exchange.from === "customer" ? "Cliente" : "Asistente"}</small>{exchange.text}</p>
              <span className="lp-convo-link" aria-hidden="true"><svg viewBox="0 0 56 20"><path d="M2 10h44M38 3l10 7-10 7" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div className="lp-act"><b>{exchange.action}</b><span>{exchange.actionDetail}</span></div>
            </div>)}
          </div>
          <div className="lp-rules">
            <div><h3><Illustration name="bot" size={44} /> {landing.assistantDemo.canTitle}</h3><ul>{landing.assistantDemo.can.map((item) => <li key={item}><Check size={18} strokeWidth={3} /> {item}</li>)}</ul></div>
            <div><h3><Illustration name="shield" size={44} /> {landing.assistantDemo.cannotTitle}</h3><ul>{landing.assistantDemo.cannot.map((item) => <li key={item}><X size={18} strokeWidth={3} /> {item}</li>)}</ul></div>
          </div>
        </div>
      </section>}

      {landing.beforeAfter && <section className="lp-band" aria-labelledby="lp-t-ab">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">{landing.beforeAfter.eyebrow}</span>
            <h2 id="lp-t-ab">{landing.beforeAfter.title}</h2>
          </div>
          <div className="lp-ab" data-before={landing.beforeAfter.beforeLabel} data-after={landing.beforeAfter.afterLabel}>
            <div className="lp-ab-h">{landing.beforeAfter.beforeLabel}</div><div aria-hidden="true" /><div className="lp-ab-h">{landing.beforeAfter.afterLabel}</div>
            {landing.beforeAfter.rows.map((row) => <div className="lp-ab-row" key={row.before}>
              <div className="lp-ab-before"><span className="lp-ab-tag">{landing.beforeAfter!.beforeLabel}</span>{row.before}{row.beforeNote && <small>{row.beforeNote}</small>}</div>
              <span className="lp-ab-to" aria-hidden="true"><svg viewBox="0 0 40 24"><path d="M2 12h30M24 4l10 8-10 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div className="lp-ab-after"><span className="lp-ab-tag">{landing.beforeAfter!.afterLabel}</span>{row.after}</div>
            </div>)}
          </div>
        </div>
      </section>}

      <section className="lp-band lp-lime" id="mision" aria-labelledby="lp-t-mission">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">{landing.missionEyebrow}</span>
            <h2 id="lp-t-mission">{landing.missionTitle}</h2>
            <p className="lp-lead">{landing.missionDescription}</p>
          </div>
          <div className="lp-gains">{landing.benefits.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
        </div>
      </section>

      <section className="lp-band" id="soluciones" aria-labelledby="lp-t-solutions">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">{landing.solutionsEyebrow}</span>
            <h2 id="lp-t-solutions">{landing.solutionsTitle}</h2>
            <p className="lp-lead">{landing.solutionsDescription}</p>
          </div>
          <div className="lp-tiles">{landing.capabilities.map((item, index) => <article className="lp-tile" key={item.title}>
            <Illustration name={capabilityIllustrations[index % capabilityIllustrations.length]} size={68} />
            <span className="lp-tag">{item.tag}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>)}</div>
        </div>
      </section>

      {edition.productShowcase.length > 0 && <section className="lp-band lp-lilac" id="producto" aria-labelledby="lp-t-product">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">{landing.productEyebrow}</span>
            <h2 id="lp-t-product">{landing.productTitle}</h2>
            <p className="lp-lead">{landing.productDescription}</p>
          </div>
          <div className="lp-showcase">
            <Carousel>
              {edition.productShowcase.map((item) => <div className="lp-browser" key={item.key}>
                <div className="lp-browser-bar"><span /><span /><span /><em>{item.pathLabel.startsWith("/") ? `${productHost}${item.pathLabel}` : item.pathLabel}</em></div>
                <Image src={item.imagePath} alt={`${item.alt} · ${brand.name}`} width={item.width} height={item.height} quality={95} style={{ width: "100%", height: "auto" }} sizes="(max-width: 1240px) 100vw, 1180px" />
              </div>)}
            </Carousel>
          </div>
        </div>
      </section>}

      {edition.caseStudies.length > 0 && <section className="lp-band" id="casos" aria-labelledby="lp-t-cases">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">{landing.caseStudyEyebrow}</span>
            <h2 id="lp-t-cases">{landing.caseStudyTitle}</h2>
            <p className="lp-lead">{landing.caseStudyDescription}</p>
          </div>
          <div className="lp-cases">{edition.caseStudies.map((item) => <div className="lp-browser" key={item.key}>
            <div className="lp-browser-bar"><span /><span /><span /><em>{item.pathLabel}</em></div>
            <Image src={item.imagePath} alt={item.alt} width={item.width} height={item.height} quality={95} style={{ width: "100%", height: "auto" }} sizes="(max-width: 900px) 100vw, 46vw" />
          </div>)}</div>
        </div>
      </section>}

      <section className="lp-band lp-ink" id="como-funciona" aria-labelledby="lp-t-process">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker lp-kicker-lime">{landing.processEyebrow}</span>
            <h2 id="lp-t-process">{landing.processTitle}</h2>
            <p className="lp-lead">{landing.processDescription}</p>
          </div>
          <ol className="lp-steps">{landing.processSteps.map((step) => <li key={step.title}><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
        </div>
      </section>

      {/* Precios por jornada: sólo en ediciones con cotizador de servicios. */}
      {isModuleEnabled("quotes") && <section className="lp-band" id="precios" aria-labelledby="lp-t-pricing">
        <div className="lp-wrap">
          <div className="lp-pricing lp-sheet">
            <div className="lp-stack">
              <span className="lp-kicker">{landing.pricingEyebrow}</span>
              <h2 id="lp-t-pricing">{landing.pricingTitle}</h2>
              <p className="lp-price"><span>implementación desde</span><strong>{money(edition.pricing.minimumImplementation)}</strong></p>
              <ul className="lp-checks">{landing.pricingBenefits.map((item) => <li key={item}><Check size={18} strokeWidth={3} /> {interpolate(item)}</li>)}</ul>
              <div className="lp-actions"><Link href="/diagnostico" className="lp-btn lp-btn-primary">{landing.primaryCtaLabel} <ArrowRight size={18} /></Link></div>
            </div>
            <aside className="lp-tiers" aria-label="Beneficio de expansión">
              <h3>Más soluciones, mejor precio.</h3>
              <p>El beneficio se aplica a cada nueva implementación y su mantención, sin cambiar lo que ya acordamos.</p>
              <table>
                <tbody>{edition.pricing.expansionDiscountTiers.map((tier, index) => <tr key={tier.fromSolution}>
                  <th scope="row">{tier.fromSolution}ª {index === edition.pricing.expansionDiscountTiers.length - 1 ? "y siguientes" : "solución"}</th>
                  <td>{tier.discountPercent === 0 ? "Precio base" : `−${tier.discountPercent}%`}</td>
                </tr>)}</tbody>
              </table>
            </aside>
          </div>
        </div>
      </section>}

      <section className="lp-band lp-cta-band" aria-labelledby="lp-t-cta">
        <div className="lp-wrap">
          <div className="lp-cta lp-sheet">
            <div className="lp-stack">
              <h2 id="lp-t-cta">{landing.finalCtaTitle}</h2>
              <p className="lp-lead">{landing.finalCtaDescription}</p>
            </div>
            <div className="lp-actions"><Link href="/diagnostico" className="lp-btn lp-btn-primary">{landing.primaryCtaLabel} <ArrowRight size={18} /></Link>{secondaryCta}</div>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
