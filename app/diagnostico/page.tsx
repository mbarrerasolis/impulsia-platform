import type { Metadata } from "next";
import { DiagnosticForm } from "@/components/diagnostic-form";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { socialMetadata } from "@/lib/seo";
import { landingFontClasses } from "../landing-fonts";
import "../landing.css";

export function generateMetadata(): Metadata {
  const brand = getBrandConfig();
  const edition = getEditionConfig();
  const description = edition.landing.diagnosticMetaDescription ?? edition.landing.diagnosticDescription;
  const metaTitle = edition.landing.diagnosticMetaTitle ?? edition.landing.diagnosticTitle;
  return {
    title: metaTitle,
    description,
    alternates: { canonical: "/diagnostico" },
    ...socialMetadata({ title: `${metaTitle} | ${brand.name}`, description, path: "/diagnostico" }),
  };
}

export default function DiagnosticPage() {
  const brand = getBrandConfig();
  const edition = getEditionConfig();
  return <div className={`lp ${landingFontClasses}`}><SiteHeader/><main><header className="lp-page-hero"><div className="lp-wrap lp-stack"><span className="lp-kicker">{edition.landing.diagnosticEyebrow}</span><h1>{edition.landing.diagnosticTitle}</h1><p className="lp-lead">{edition.landing.diagnosticDescription}</p></div></header><section className="lp-wrap lp-page-body"><div className="lp-form"><DiagnosticForm brandName={brand.name} contactHref={brand.contactHref} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}/></div></section></main><SiteFooter/></div>;
}
