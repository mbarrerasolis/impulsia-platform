import "server-only";
import activeEdition from "@/config/edition.json";
import { createBrandConfig, type BrandConfigSource } from "@/domain/config/brand";

export function getBrandConfig() {
  return createBrandConfig({
    name: process.env.NEXT_PUBLIC_BRAND_NAME || activeEdition.brand.name,
    legalName: process.env.NEXT_PUBLIC_BRAND_LEGAL_NAME || activeEdition.brand.legalName,
    taxId: process.env.NEXT_PUBLIC_BRAND_TAX_ID || (activeEdition.brand as { taxId?: string }).taxId,
    tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || activeEdition.brand.tagline,
    description: process.env.NEXT_PUBLIC_BRAND_DESCRIPTION || activeEdition.brand.description,
    seoTitle: process.env.NEXT_PUBLIC_BRAND_SEO_TITLE || ("seoTitle" in activeEdition.brand ? activeEdition.brand.seoTitle : undefined),
    seoDescription: process.env.NEXT_PUBLIC_BRAND_SEO_DESCRIPTION || ("seoDescription" in activeEdition.brand ? activeEdition.brand.seoDescription : undefined),
    contactEmail: process.env.NEXT_PUBLIC_BRAND_CONTACT_EMAIL || activeEdition.brand.contactEmail,
    heroEyebrow: process.env.NEXT_PUBLIC_BRAND_HERO_EYEBROW || activeEdition.brand.heroEyebrow,
    heroTitle: process.env.NEXT_PUBLIC_BRAND_HERO_TITLE || activeEdition.brand.heroTitle,
    heroHighlight: process.env.NEXT_PUBLIC_BRAND_HERO_HIGHLIGHT || activeEdition.brand.heroHighlight,
    heroDescription: process.env.NEXT_PUBLIC_BRAND_HERO_DESCRIPTION || activeEdition.brand.heroDescription,
    whatsappMessage: process.env.NEXT_PUBLIC_WHATSAPP_MESSAGE || activeEdition.brand.whatsappMessage,
    primaryColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || activeEdition.brand.primaryColor,
    primaryDarkColor: process.env.NEXT_PUBLIC_BRAND_PRIMARY_DARK_COLOR || activeEdition.brand.primaryDarkColor,
    accentColor: process.env.NEXT_PUBLIC_BRAND_ACCENT_COLOR || activeEdition.brand.accentColor,
    darkSurfaceColor: process.env.NEXT_PUBLIC_BRAND_DARK_SURFACE_COLOR || activeEdition.brand.darkSurfaceColor,
    social: (activeEdition.brand as { social?: BrandConfigSource["social"] }).social,
    notificationCc: (activeEdition.brand as { notificationCc?: string[] }).notificationCc,
  });
}
