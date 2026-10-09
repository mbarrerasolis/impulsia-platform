"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { isPrivatePath } from "@/lib/public-paths";
import {
  captureAttribution, consentChangedEvent, recordVisit, consentOpenEvent, loadMetaPixel, readConsent, saveConsent, trackMetaEvent,
  type MarketingConsent,
} from "@/lib/marketing/browser";

function subscribeConsent(onChange: () => void) {
  window.addEventListener(consentChangedEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(consentChangedEvent, onChange); window.removeEventListener("storage", onChange); };
}

/**
 * Registra el origen de la visita (UTM) y, sólo si la persona acepta cookies de publicidad, carga el
 * píxel de Meta. Sin `pixelId` configurado no hay nada que consentir y no se muestra el banner.
 */
export function MarketingTags({ pixelId }: { pixelId?: string }) {
  const pathname = usePathname();
  // En el servidor (y al hidratar) aún no se conoce la decisión: "pending" evita mostrar el banner un instante.
  const stored = useSyncExternalStore(subscribeConsent, () => readConsent() ?? "none", () => "pending" as const);
  const consent = stored === "granted" || stored === "denied" ? stored : undefined;
  const ready = stored !== "pending";
  const [bannerOpen, setBannerOpen] = useState(false);
  const isPrivate = isPrivatePath(pathname);

  useEffect(() => {
    captureAttribution();
    if (!isPrivatePath(window.location.pathname)) recordVisit();
    const open = () => setBannerOpen(true);
    window.addEventListener(consentOpenEvent, open);
    return () => window.removeEventListener(consentOpenEvent, open);
  }, []);

  // Cada navegación (también las del lado del cliente) cuenta como una vista de página.
  useEffect(() => {
    if (!pixelId || consent !== "granted" || isPrivate) return;
    loadMetaPixel(pixelId);
    trackMetaEvent("PageView");
  }, [pixelId, consent, isPrivate, pathname]);

  if (!pixelId || !ready || isPrivate || (consent && !bannerOpen)) return null;

  function choose(value: MarketingConsent) {
    saveConsent(value);
    setBannerOpen(false);
  }

  return <section className="consent-banner" role="dialog" aria-live="polite" aria-label="Preferencias de cookies">
    <p>Usamos cookies de Meta para medir qué publicaciones y anuncios nos traen consultas. Sólo se activan si las aceptas. <Link href="/privacidad#cookies">Más información</Link></p>
    <div className="consent-actions">
      <button type="button" className="btn btn-secondary" onClick={() => choose("denied")}>Rechazar</button>
      <button type="button" className="btn btn-primary" onClick={() => choose("granted")}>Aceptar</button>
    </div>
  </section>;
}

/** Enlace del pie de página para cambiar la decisión en cualquier momento. */
export function CookiePreferencesButton() {
  return <button type="button" className="footer-link-button" onClick={() => window.dispatchEvent(new Event(consentOpenEvent))}>Cookies</button>;
}
