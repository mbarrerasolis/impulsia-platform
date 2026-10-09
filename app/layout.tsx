import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { MarketingTags } from "@/components/marketing-tags";
import { WhatsAppLeadButton } from "@/components/whatsapp-lead-button";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { getStorefront } from "@/lib/storefront";
import { socialMetadata } from "@/lib/seo";
import { getPublicSiteUrl } from "@/lib/site-url";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export function generateMetadata(): Metadata {
  const brand = getBrandConfig();
  const siteUrl = getPublicSiteUrl();
  const title = brand.seoTitle ?? `${brand.name} | ${brand.tagline}`;
  const description = brand.seoDescription ?? brand.description;
  // Códigos de verificación de Google Search Console y Meta Business (públicos, no secretos).
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined;
  const facebook = process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION || undefined;
  return {
    title: { default: title, template: `%s | ${brand.name}` },
    description,
    applicationName: brand.name,
    publisher: brand.legalName,
    metadataBase: siteUrl,
    ...socialMetadata({ title, description, path: "/" }),
    ...(google || facebook
      ? { verification: { ...(google ? { google } : {}), ...(facebook ? { other: { "facebook-domain-verification": facebook } } : {}) } }
      : {}),
  };
}

/** Datos estructurados (schema.org) de la empresa y el sitio, para el panel de Google. */
function organizationJsonLd(brand: ReturnType<typeof getBrandConfig>, whatsappNumber?: string) {
  const siteUrl = getPublicSiteUrl().toString();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": getStorefront() ? "Store" : "ProfessionalService",
        "@id": `${siteUrl}#organizacion`,
        name: brand.name,
        legalName: brand.legalName,
        ...(brand.taxId ? { taxID: brand.taxId } : {}),
        url: siteUrl,
        logo: new URL("/apple-icon", siteUrl).toString(),
        image: new URL("/opengraph-image", siteUrl).toString(),
        description: brand.seoDescription ?? brand.description,
        email: brand.contactEmail,
        ...(whatsappNumber ? { telephone: `+${whatsappNumber}` } : {}),
        areaServed: { "@type": "Country", name: "Chile" },
        ...(Object.values(brand.social).length ? { sameAs: Object.values(brand.social) } : {}),
        address: { "@type": "PostalAddress", addressCountry: "CL" },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#sitio`,
        url: siteUrl,
        name: brand.name,
        inLanguage: getEditionConfig().locale,
        publisher: { "@id": `${siteUrl}#organizacion` },
      },
    ],
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const brand = getBrandConfig();
  const edition = getEditionConfig();
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || undefined;
  const theme = {
    "--teal": brand.primaryColor,
    "--teal-dark": brand.primaryDarkColor,
    "--lime": brand.accentColor,
    "--brand-surface-dark": brand.darkSurfaceColor,
    "--brand-primary-rgb": brand.primaryRgb,
    "--brand-primary-dark-rgb": brand.primaryDarkRgb,
    "--brand-accent-rgb": brand.accentRgb,
  } as CSSProperties;
  return <html lang={edition.locale.split("-")[0]} className={manrope.variable}><body style={theme}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(brand, whatsappNumber)).replace(/</g, "\\u003c") }}/>{children}<WhatsAppLeadButton brandName={brand.name} number={whatsappNumber} message={brand.whatsappMessage} fallback={getStorefront() ? { href: "/#productos", label: "Mira el catálogo y arma tu pedido" } : undefined}/><MarketingTags pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined}/></body></html>;
}
