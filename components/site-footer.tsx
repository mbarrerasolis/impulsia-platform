import Link from "next/link";
import { getBrandConfig } from "@/lib/brand";
import { getStorefront } from "@/lib/storefront";
import { Brand } from "./brand";
import { CookiePreferencesButton } from "./marketing-tags";

const SOCIAL_LABELS = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube" } as const;

export function SiteFooter() {
  const brand = getBrandConfig();
  const social = (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).filter((key) => brand.social[key]);
  return <footer className="site-footer">
    <div className="container footer-row">
      <Brand name={brand.name} emblem={getStorefront()?.emblem} />
      <span>{brand.tagline}</span>
      <span className="footer-links"><Link href="/terminos">Términos</Link><Link href="/privacidad">Privacidad</Link>{process.env.NEXT_PUBLIC_META_PIXEL_ID && <CookiePreferencesButton/>}<Link href="/login">Ingresar</Link></span>
      {social.length > 0 && <nav className="footer-links footer-social" aria-label={`${brand.name} en redes sociales`}>
        {social.map((key) => <a key={key} href={brand.social[key]} target="_blank" rel="noopener noreferrer me">{SOCIAL_LABELS[key]}</a>)}
      </nav>}
    </div>
  </footer>;
}
