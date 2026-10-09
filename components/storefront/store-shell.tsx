import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { AuthSetupRedirect } from "@/components/auth-setup-redirect";
import { SiteFooter } from "@/components/site-footer";
import type { Storefront } from "@/domain/config/storefront";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { storefrontFontClasses } from "@/app/storefront-fonts";
import { getServerEnv } from "@/lib/env";
import { CartButton, CartDrawer } from "./store-interactions";
import { StoreChat } from "./store-chat";
import { StoreProvider } from "./store-provider";

/** WhatsApp o correo de la tienda para enviar el pedido. */
export function storeContact() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || undefined;
  return { whatsappNumber, email: getBrandConfig().contactEmail };
}

/** Marco común de la tienda: carro compartido, aviso, encabezado, pie y panel del carro. */
export function StoreShell({ storefront, children }: { storefront: Storefront; children: ReactNode }) {
  const brand = getBrandConfig();
  const edition = getEditionConfig();
  const env = getServerEnv();
  // El chat necesita la IA configurada y la base real (guarda las conversaciones en la bandeja).
  const chatEnabled = env.APP_MODE === "supabase" && env.AI_PROVIDER === "anthropic" && Boolean(env.ANTHROPIC_API_KEY);

  return <StoreProvider storageKey={`store-cart:${brand.name}`} greeting={storefront.orderGreeting} contact={storeContact()} currency={edition.pricing.currency} locale={edition.locale} rules={storefront.pricing}>
    <div className={`st ${storefrontFontClasses}`}>
      <AuthSetupRedirect />
      {storefront.announcement && <p className="st-announce">{storefront.announcement}</p>}
      <header className="st-top">
        <div className="st-wrap st-top-row">
          <Link href="/" className="st-top-logo" aria-label={`${brand.name}, inicio`}>
            {storefront.logo
              ? <Image src={storefront.logo.src} alt={storefront.logo.alt} width={storefront.logo.width} height={storefront.logo.height} priority unoptimized />
              : <span className="st-wordmark">{brand.name}</span>}
          </Link>
          <nav className="st-top-nav" aria-label="Secciones">
            <Link href={"/#categorias" as Route}>Categorías</Link>
            {storefront.mix && <Link href={"/#mix" as Route}>{storefront.mix.wholesale ? "Mix mayorista" : "Arma tu mix"}</Link>}
            {storefront.wholesale && <Link href={"/#mayoristas" as Route}>Mayoristas</Link>}
            <Link href={"/#como-comprar" as Route}>Cómo comprar</Link>
          </nav>
          <div className="st-top-actions">
            {/* Acceso del equipo al panel (leads, conversaciones, inventario, campañas); los clientes no tienen cuenta. */}
            <Link href="/login" className="st-staff-link" title="Acceso del equipo al panel"><LockKeyhole size={16} aria-hidden="true" /><span>Equipo</span></Link>
            <CartButton />
          </div>
        </div>
      </header>
      {children}
      <SiteFooter />
      <CartDrawer brandName={brand.name} />
      {chatEnabled && <StoreChat assistantName={storefront.assistant?.name} brandName={brand.name} suggestions={["¿Qué mix me recomiendas?", "Quiero comprar para mi negocio", "¿Cómo es el despacho?"]} />}
    </div>
  </StoreProvider>;
}
