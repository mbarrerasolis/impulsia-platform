"use client";

import { Send } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { orderLeadSchema } from "@/domain/storefront/order-lead";
import { readAttribution, trackMetaEvent } from "@/lib/marketing/browser";
import { useStore } from "./store-provider";

const savedKey = "store-customer";

interface Customer { name: string; phone: string; email: string; city: string; customerType: "persona" | "negocio"; company: string }

function readSaved(): Customer | undefined {
  try { return JSON.parse(window.localStorage.getItem(savedKey) ?? "null") ?? undefined; } catch { return undefined; }
}

/**
 * Datos mínimos antes de enviar el pedido: se registra en el CRM (sin esperar la respuesta) y se abre
 * WhatsApp o el correo con el pedido y los datos del cliente. Si el registro falla, el pedido igual sale.
 */
export function CheckoutForm({ onCancel }: { onCancel: () => void }) {
  const { lines, checkoutHrefWith, checkoutChannel } = useStore();
  const [customer, setCustomer] = useState<Customer>(() => readSaved() ?? { name: "", phone: "", email: "", city: "", customerType: "persona", company: "" });
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const honeypot = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Customer>) => setCustomer((current) => ({ ...current, ...patch }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...customer, notes, consentGiven: consent, channel: checkoutChannel === "WhatsApp" ? "whatsapp" : "email", items: lines.map((line) => ({ id: line.id, quantity: line.quantity })), attribution: readAttribution() };
    const parsed = orderLeadSchema.safeParse(payload);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisa los datos."); return; }
    setError("");
    try { window.localStorage.setItem(savedKey, JSON.stringify(customer)); } catch { /* sin almacenamiento */ }
    const extra = [
      `Nombre: ${customer.name}`,
      ...(customer.customerType === "negocio" ? [`Negocio: ${customer.company}`] : []),
      `Despacho: ${customer.city}`,
      ...(checkoutChannel === "correo" ? [`Teléfono: ${customer.phone}`] : []),
      ...(notes ? [`Comentarios: ${notes}`] : []),
    ];
    // Se abre en el mismo gesto del usuario (si no, el navegador lo bloquea) y el registro va en paralelo.
    window.open(checkoutHrefWith(extra), "_blank", "noopener");
    trackMetaEvent("Contact");
    void fetch("/api/store/orders", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, website: honeypot.current?.value ?? "", elapsedMs: Date.now() - startedAt }),
    }).catch(() => { /* el pedido ya salió por WhatsApp o correo */ });
    setSent(true);
  };

  if (sent) return <div className="st-checkout-done" role="status">
    <p><b>¡Listo, {customer.name.split(" ")[0]}!</b> Te abrimos {checkoutChannel} con tu pedido: envía el mensaje y te confirmamos stock, despacho y forma de pago.</p>
    <p className="st-drawer-note">¿No se abrió? <a href={checkoutHrefWith([`Nombre: ${customer.name}`, `Despacho: ${customer.city}`])} target="_blank" rel="noreferrer">Ábrelo aquí</a>.</p>
    <button type="button" className="st-link" onClick={onCancel}>Volver al carro</button>
  </div>;

  return <form className="st-checkout-form" onSubmit={submit} noValidate>
    <h3>Tus datos para el pedido</h3>
    <div className="st-seg" role="radiogroup" aria-label="Compras como">
      {(["persona", "negocio"] as const).map((type) => <label key={type}><input type="radio" name="customerType" checked={customer.customerType === type} onChange={() => set({ customerType: type })} /> {type === "persona" ? "Para mi casa" : "Para mi negocio"}</label>)}
    </div>
    <label>Nombre<input value={customer.name} onChange={(event) => set({ name: event.target.value })} autoComplete="name" maxLength={100} required /></label>
    {customer.customerType === "negocio" && <label>Nombre del negocio<input value={customer.company} onChange={(event) => set({ company: event.target.value })} autoComplete="organization" maxLength={140} /></label>}
    <label>Teléfono / WhatsApp<input value={customer.phone} onChange={(event) => set({ phone: event.target.value })} type="tel" inputMode="tel" autoComplete="tel" placeholder="+56 9 1234 5678" maxLength={20} required /></label>
    <label>Ciudad o comuna de despacho<input value={customer.city} onChange={(event) => set({ city: event.target.value })} autoComplete="address-level2" maxLength={120} required /></label>
    <label>Email <small>(opcional)</small><input value={customer.email} onChange={(event) => set({ email: event.target.value })} type="email" autoComplete="email" maxLength={200} /></label>
    <label>Comentarios <small>(opcional)</small><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={1000} placeholder="Boleta o factura, retiro, horario…" /></label>
    <input ref={honeypot} className="st-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    <label className="st-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Autorizo que me contacten por este pedido.</label>
    {error && <p className="st-form-error" role="alert">{error}</p>}
    <button type="submit" className="st-btn st-btn-hot st-checkout">Enviar pedido por {checkoutChannel} <Send size={18} aria-hidden="true" /></button>
    <button type="button" className="st-link" onClick={onCancel}>Volver al carro</button>
  </form>;
}
