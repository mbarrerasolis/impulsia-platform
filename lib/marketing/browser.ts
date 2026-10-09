import { attributionFromLanding, parseLeadAttribution, type LeadAttribution } from "@/domain/marketing/attribution";

/**
 * Estado de marketing en el navegador: consentimiento de cookies de publicidad, origen de la visita
 * y eventos del píxel de Meta. Todo guardado en localStorage del propio sitio; cualquier fallo
 * (modo privado, almacenamiento bloqueado) se trata como "sin datos".
 */

export type MarketingConsent = "granted" | "denied";

const consentKey = "impulsia.consent.marketing";
const attributionKey = "impulsia.attribution";
const attributionMaxAgeMs = 90 * 24 * 60 * 60 * 1000;
export const consentChangedEvent = "impulsia:consent-changed";
export const consentOpenEvent = "impulsia:consent-open";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; loaded: boolean; version: string; push: Fbq };

declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

function storage() {
  try { return window.localStorage; } catch { return undefined; }
}

export function readConsent(): MarketingConsent | undefined {
  try {
    const value = storage()?.getItem(consentKey);
    return value === "granted" || value === "denied" ? value : undefined;
  } catch { return undefined; }
}

export function saveConsent(value: MarketingConsent) {
  try { storage()?.setItem(consentKey, value); } catch { /* sin almacenamiento: vale sólo para esta página */ }
  if (value === "denied") window.fbq?.("consent", "revoke");
  window.dispatchEvent(new CustomEvent(consentChangedEvent, { detail: value }));
}

/** Guarda el origen de esta visita si trae UTM, clic de anuncio o referrer externo (el último origen gana). */
export function captureAttribution() {
  const found = attributionFromLanding(new URL(window.location.href), document.referrer || undefined, new Date());
  if (!found) return;
  try { storage()?.setItem(attributionKey, JSON.stringify(found)); } catch { /* sin almacenamiento */ }
}

export function readAttribution(): LeadAttribution | undefined {
  try {
    const raw = storage()?.getItem(attributionKey);
    const value = raw ? parseLeadAttribution(JSON.parse(raw)) : undefined;
    if (value?.capturedAt && Date.now() - Date.parse(value.capturedAt) > attributionMaxAgeMs) return undefined;
    return value;
  } catch { return undefined; }
}

function readCookie(name: string) {
  return document.cookie.split("; ").find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || undefined;
}

/** Datos para la Conversions API; sólo existen si la persona aceptó las cookies de publicidad. */
export function marketingSignals() {
  if (readConsent() !== "granted") return undefined;
  const attribution = readAttribution();
  const fbc = readCookie("_fbc") ?? (attribution?.fbclid && attribution.capturedAt ? `fb.1.${Date.parse(attribution.capturedAt)}.${attribution.fbclid}` : undefined);
  return { consent: true as const, fbp: readCookie("_fbp"), fbc, pageUrl: window.location.href.split("#")[0] };
}

/** Evento del píxel; no hace nada si el píxel no está cargado (sin consentimiento o sin configurar). */
export function trackMetaEvent(name: "PageView" | "Lead" | "Contact" | "Schedule", eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (eventId) window.fbq("track", name, {}, { eventID: eventId });
  else window.fbq("track", name);
}

/** Carga fbevents.js (fragmento oficial de Meta) e inicializa el píxel una sola vez. */
export function loadMetaPixel(pixelId: string) {
  // Ya cargado en esta página (se revocó y se volvió a aceptar): sólo reactiva el envío.
  if (window.fbq) { window.fbq("consent", "grant"); return; }
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("consent", "grant");
  fbq("init", pixelId);
}

const visitKey = "impulsia.visit";

/**
 * Cuenta una visita por sesión de navegación (anónima: un identificador aleatorio que vive sólo en
 * esta pestaña, sin cookies). Envía el origen guardado para medir la conversión visita → lead.
 */
export function recordVisit() {
  try {
    const session = window.sessionStorage;
    if (session.getItem(visitKey)) return;
    const sessionId = crypto.randomUUID().replaceAll("-", "");
    session.setItem(visitKey, sessionId);
    const body = JSON.stringify({ sessionId, landingPath: window.location.pathname.slice(0, 300), attribution: readAttribution() });
    if (!navigator.sendBeacon?.("/api/visits", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/visits", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  } catch { /* sin almacenamiento de sesión: no se cuenta */ }
}
