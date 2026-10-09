import type { MetadataRoute } from "next";
import { getBusinessProfile } from "@/lib/business";
import { getStorefront } from "@/lib/storefront";
import { getPublicSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getPublicSiteUrl();
  const { sectorLandings } = getBusinessProfile();
  // Tienda: una ficha por producto.
  const products = getStorefront()?.products ?? [];
  return [
    { url: siteUrl.toString(), changeFrequency: "monthly", priority: 1 },
    { url: new URL("/diagnostico", siteUrl).toString(), changeFrequency: "monthly", priority: 0.9 },
    ...(getBusinessProfile().modules.meetings ? [{ url: new URL("/agendar", siteUrl).toString(), changeFrequency: "monthly" as const, priority: 0.9 }] : []),
    ...products.map((product) => ({ url: new URL(`/productos/${product.key}`, siteUrl).toString(), changeFrequency: "weekly" as const, priority: product.featured ? 0.8 : 0.6 })),
    ...sectorLandings.map((landing) => ({ url: new URL(`/${landing}`, siteUrl).toString(), changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: new URL("/privacidad", siteUrl).toString(), changeFrequency: "yearly", priority: 0.3 },
    { url: new URL("/terminos", siteUrl).toString(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
