import type { Metadata } from "next";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";

/**
 * Open Graph y Twitter de una página. Next reemplaza (no fusiona) el `openGraph` del layout
 * cuando una página define el suyo, así que cada página pública arma el objeto completo;
 * sin esto, las internas se compartían con el título y la URL de la portada.
 * La imagen de `app/opengraph-image.tsx` se declara explícitamente: Next sólo la agrega sola
 * en la portada y la pierde en las páginas que definen su propio `openGraph`.
 */
export function socialMetadata(input: { title: string; description: string; path: string }): Pick<Metadata, "openGraph" | "twitter"> {
  const brand = getBrandConfig();
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: `${brand.name} | ${brand.tagline}` };
  return {
    openGraph: { type: "website", siteName: brand.name, locale: getEditionConfig().locale.replace("-", "_"), title: input.title, description: input.description, url: input.path, images: [image] },
    twitter: { card: "summary_large_image", title: input.title, description: input.description, images: [image] },
  };
}
