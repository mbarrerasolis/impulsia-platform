import Image from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";
import { ArrowRight } from "lucide-react";
import { getBrandConfig } from "@/lib/brand";
import { isModuleEnabled } from "@/lib/business";
import { getEditionConfig } from "@/lib/edition";
import { getStorefront } from "@/lib/storefront";
import { Brand } from "./brand";

/**
 * `cta` reemplaza el botón principal; `focused` oculta el resto de la navegación (landings de campaña: una sola acción).
 */
export function SiteHeader({ cta, focused = false }: { cta?: { href: ComponentProps<typeof Link>["href"]; label: string }; focused?: boolean } = {}) {
  const brand = getBrandConfig();
  const { landing } = getEditionConfig();
  const storefront = getStorefront();
  if (storefront) return <header className="site-header">
    <div className="container nav">
      <Link href="/" aria-label={`${brand.name}, inicio`}>
        {storefront.logo
          ? <Image className="st-logo" src={storefront.logo.src} alt={storefront.logo.alt} width={storefront.logo.width} height={storefront.logo.height} priority unoptimized />
          : <Brand name={brand.name} />}
      </Link>
      <nav className="nav-links" aria-label="Navegación principal">
        <Link href="/#como-comprar">Cómo comprar</Link>
        <Link className="btn btn-primary" href="/#catalogo">Ver productos <ArrowRight size={16} /></Link>
      </nav>
    </div>
  </header>;
  return <header className="site-header">
    <div className="container nav">
      <Link href="/" aria-label={`${brand.name}, inicio`}><Brand name={brand.name} /></Link>
      <nav className="nav-links" aria-label="Navegación principal">
        {!focused && <>
          <Link href="/#soluciones">Soluciones</Link>
          <Link href="/#como-funciona">Cómo funciona</Link>
          {isModuleEnabled("quotes") && <Link href="/#precios">Precios</Link>}
          <Link href="/login">Ingresar</Link>
        </>}
        <Link className="btn btn-primary" href={cta?.href ?? "/diagnostico"}>{cta?.label ?? landing.primaryCtaLabel} <ArrowRight size={16} /></Link>
      </nav>
    </div>
  </header>;
}
