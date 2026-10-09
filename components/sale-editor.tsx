"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { deliveryModeLabels, deliveryModes, nextStatuses, paymentMethodLabels, saleStatusLabels, type DeliveryMode, type PaymentMethod, type SaleStatus } from "@/domain/storefront/sales";

/** Presentación del catálogo que se puede cotizar. */
export interface VariantOption {
  variantKey: string;
  label: string;
}

export interface EditorLine {
  variantKey: string;
  quantity: number;
}

async function send(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as { error?: string; issues?: Array<{ path: unknown[]; message: string }>; id?: string; warnings?: string[]; problems?: string[] };
  if (!response.ok) throw new Error(result.issues?.length ? `${result.issues[0].path.join(".")}: ${result.issues[0].message}` : result.error ?? "No fue posible guardar.");
  return result;
}

const toItems = (lines: EditorLine[]) => lines.filter((line) => line.variantKey && line.quantity > 0).map((line) => {
  const [clave, presentacion = ""] = line.variantKey.split("::");
  return { clave, presentacion, cantidad: line.quantity };
});

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function run(task: () => Promise<{ warnings?: string[] } | void>, after?: () => void) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await task();
      if (result?.warnings?.length) setNotice(`Ojo: ${result.warnings.join(" · ")}`);
      after?.();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, notice, run };
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  return <>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
  </>;
}

/** Productos y cantidades de una cotización. */
export function LinesEditor({ options, lines, onChange }: { options: VariantOption[]; lines: EditorLine[]; onChange: (lines: EditorLine[]) => void }) {
  const set = (index: number, patch: Partial<EditorLine>) => onChange(lines.map((line, position) => position === index ? { ...line, ...patch } : line));
  return <div className="sale-lines">
    {lines.map((line, index) => <div className="sale-line" key={index}>
      <label className="sr-only" htmlFor={`sale-variant-${index}`}>Producto</label>
      <select id={`sale-variant-${index}`} value={line.variantKey} onChange={(event) => set(index, { variantKey: event.target.value })}>
        <option value="">Elige un producto…</option>
        {options.map((option) => <option key={option.variantKey} value={option.variantKey}>{option.label}</option>)}
      </select>
      <label className="sr-only" htmlFor={`sale-qty-${index}`}>Cantidad</label>
      <input id={`sale-qty-${index}`} type="number" min={1} max={9999} value={line.quantity} onChange={(event) => set(index, { quantity: Number(event.target.value) })} />
      <button type="button" className="btn btn-secondary btn-sm" aria-label="Quitar producto" onClick={() => onChange(lines.filter((_, position) => position !== index))}><Trash2 size={14} /></button>
    </div>)}
    <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...lines, { variantKey: "", quantity: 1 }])}><Plus size={14} /> Agregar producto</button>
  </div>;
}

/** Cotización nueva armada por el equipo (p. ej. un pedido que llegó por teléfono). */
export function NewSaleForm({ options, leadId, defaults }: { options: VariantOption[]; leadId?: string; defaults?: { name?: string; company?: string; phone?: string; email?: string; destination?: string } }) {
  const router = useRouter();
  const { busy, error, notice, run } = useAction();
  const [lines, setLines] = useState<EditorLine[]>([{ variantKey: "", quantity: 1 }]);
  const [kind, setKind] = useState<"persona" | "negocio">(defaults?.company && defaults.company !== "Particular" ? "negocio" : "persona");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const shipping = text("shipping");
    void run(async () => {
      const result = await send("/api/admin/sales", {
        customer: { name: text("name"), kind, company: kind === "negocio" ? text("company") : "", taxId: text("taxId"), phone: text("phone"), email: text("email") },
        destination: text("destination"),
        deliveryMode: text("deliveryMode"),
        items: toItems(lines),
        ...(shipping ? { shipping: Number(shipping) } : {}),
        ...(text("notes") ? { notes: text("notes") } : {}),
        ...(leadId ? { leadId } : {}),
      });
      router.push(`/admin/sales/${result.id}`);
    });
  };

  return <form className="card panel" onSubmit={submit}>
    <h2>Cliente</h2>
    <div className="field-grid">
      <div className="field"><label htmlFor="sale-name">Nombre</label><input id="sale-name" name="name" required minLength={2} maxLength={120} defaultValue={defaults?.name} /></div>
      <div className="field"><label htmlFor="sale-kind">Tipo</label><select id="sale-kind" value={kind} onChange={(event) => setKind(event.target.value as "persona" | "negocio")}><option value="persona">Persona</option><option value="negocio">Negocio</option></select></div>
      {kind === "negocio" && <div className="field"><label htmlFor="sale-company">Empresa</label><input id="sale-company" name="company" maxLength={140} defaultValue={defaults?.company} /></div>}
      <div className="field"><label htmlFor="sale-tax">RUT (si corresponde)</label><input id="sale-tax" name="taxId" maxLength={20} /></div>
      <div className="field"><label htmlFor="sale-phone">Teléfono</label><input id="sale-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="9 1234 5678" defaultValue={defaults?.phone} aria-describedby="sale-phone-hint" /><span className="field-hint" id="sale-phone-hint">Celular chileno o con código de país (+54…). Se guarda como +56…</span></div>
      <div className="field"><label htmlFor="sale-email">Email</label><input id="sale-email" name="email" type="email" maxLength={160} defaultValue={defaults?.email} /></div>
      <div className="field"><label htmlFor="sale-destination">Destino (región, comuna, localidad)</label><input id="sale-destination" name="destination" maxLength={200} defaultValue={defaults?.destination} /></div>
      <div className="field"><label htmlFor="sale-delivery">Entrega</label><select id="sale-delivery" name="deliveryMode" defaultValue="por_definir">{deliveryModes.map((mode) => <option key={mode} value={mode}>{deliveryModeLabels[mode]}</option>)}</select></div>
    </div>
    <h2>Productos</h2>
    <LinesEditor options={options} lines={lines} onChange={setLines} />
    <div className="field-grid" style={{ marginTop: 18 }}>
      <div className="field"><label htmlFor="sale-shipping">Transporte con IVA (vacío = por confirmar)</label><input id="sale-shipping" name="shipping" type="number" min={0} /></div>
      <div className="field"><label htmlFor="sale-notes">Observaciones</label><input id="sale-notes" name="notes" maxLength={1000} /></div>
    </div>
    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Creando…" : "Crear cotización"}</button>
    <Feedback error={error} notice={notice} />
  </form>;
}

export interface SaleActionsData {
  id: string;
  status: SaleStatus;
  paymentMethod?: PaymentMethod;
  deliveryMode: DeliveryMode;
  destination: string;
  lines: EditorLine[];
  shipping?: number;
  total: number;
  quoteText: string;
}

const statusButtonLabels: Partial<Record<SaleStatus, string>> = {
  quote_sent: "Marcar cotización enviada",
  paid: "Marcar pagada",
  preparing: "Pasar a preparación",
  ready_to_ship: "Lista para despacho",
  shipped: "Marcar despachada",
  delivered: "Marcar entregada",
};

/** Lo que el equipo puede hacer con la venta según su estado. */
export function SaleActions({ sale, options }: { sale: SaleActionsData; options: VariantOption[] }) {
  const { busy, error, notice, run } = useAction();
  const [revising, setRevising] = useState(false);
  const [lines, setLines] = useState(sale.lines);
  const [shipping, setShipping] = useState(sale.shipping === undefined ? "" : String(sale.shipping));
  const [document, setDocument] = useState<"boleta" | "factura">("boleta");
  const [tracking, setTracking] = useState("");
  const [copied, setCopied] = useState(false);
  const url = `/api/admin/sales/${sale.id}`;
  const revisable = ["quote_draft", "quote_sent", "quote_revised", "quote_accepted", "payment_pending"].includes(sale.status);
  const forward = nextStatuses(sale.status, "panel").filter((to) => to in statusButtonLabels);
  const cancellable = nextStatuses(sale.status, "panel").includes("cancelled");

  const choosePayment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    void run(() => send(url, {
      action: "payment",
      method: text("method"),
      document,
      deliveryMode: text("deliveryMode"),
      ...(text("destination") ? { destination: text("destination") } : {}),
      ...(text("carrier") ? { carrier: text("carrier") } : {}),
      ...(document === "factura" ? { billing: { legalName: text("legalName"), taxId: text("billingTaxId"), activity: text("activity"), address: text("address"), commune: text("commune"), email: text("billingEmail"), phone: text("billingPhone"), purchaseOrder: text("purchaseOrder") } } : {}),
    }));
  };
  const registerTransfer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    void run(() => send(url, { action: "transfer", amount: Number(text("amount")), ...(text("payer") ? { payer: text("payer") } : {}), ...(text("paidOn") ? { paidOn: text("paidOn") } : {}), ...(text("note") ? { note: text("note") } : {}) }));
  };

  return <section className="card panel sale-actions" aria-label="Acciones">
    <h2>Acciones</h2>
    <div className="sale-buttons">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { void navigator.clipboard.writeText(sale.quoteText).then(() => setCopied(true)); }}>{copied ? "Copiada" : "Copiar cotización"}</button>
      {["quote_sent", "quote_revised", "quote_draft"].includes(sale.status) && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(() => send(url, { action: "accept" }))}>El cliente la aceptó</button>}
      {forward.map((to) => to === "shipped"
        ? <span key={to} className="sale-inline"><input aria-label="Transportista y seguimiento" placeholder="Transportista y N° de seguimiento" value={tracking} onChange={(event) => setTracking(event.target.value)} maxLength={300} /><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(() => send(url, { action: "status", to, ...(tracking ? { tracking } : {}) }))}>{statusButtonLabels[to]}</button></span>
        : <button key={to} type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(() => send(url, { action: "status", to }))}>{statusButtonLabels[to]}</button>)}
      {revisable && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRevising(!revising)} aria-expanded={revising}>Modificar cotización</button>}
      {cancellable && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { if (window.confirm("¿Cancelar la venta? No se puede deshacer.")) void run(() => send(url, { action: "status", to: "cancelled" })); }}>Cancelar venta</button>}
    </div>

    {revising && <div className="sale-subform">
      <h3>Nueva versión</h3>
      <p className="muted">Se crea la versión siguiente con los precios vigentes y el cliente debe aceptarla de nuevo.</p>
      <LinesEditor options={options} lines={lines} onChange={setLines} />
      <div className="field" style={{ marginTop: 12 }}><label htmlFor="sale-revise-shipping">Transporte con IVA (vacío = por confirmar)</label><input id="sale-revise-shipping" type="number" min={0} value={shipping} onChange={(event) => setShipping(event.target.value)} /></div>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(() => send(url, { action: "revise", items: toItems(lines), shipping: shipping === "" ? null : Number(shipping) }), () => setRevising(false))}>Guardar nueva versión</button>
    </div>}

    {(sale.status === "quote_accepted" || sale.status === "payment_pending") && <form className="sale-subform" onSubmit={choosePayment}>
      <h3>{sale.status === "quote_accepted" ? "Forma de pago y datos del pedido" : "Cambiar forma de pago o datos del pedido"}</h3>
      <div className="field-grid">
        <div className="field"><label htmlFor="sale-method">Pago</label><select id="sale-method" name="method" defaultValue={sale.paymentMethod ?? "transfer"}>{(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((method) => <option key={method} value={method}>{paymentMethodLabels[method]}</option>)}</select></div>
        <div className="field"><label htmlFor="sale-document">Documento</label><select id="sale-document" value={document} onChange={(event) => setDocument(event.target.value as "boleta" | "factura")}><option value="boleta">Boleta</option><option value="factura">Factura</option></select></div>
        <div className="field"><label htmlFor="sale-pay-delivery">Entrega</label><select id="sale-pay-delivery" name="deliveryMode" defaultValue={sale.deliveryMode}>{deliveryModes.map((mode) => <option key={mode} value={mode}>{deliveryModeLabels[mode]}</option>)}</select></div>
        <div className="field"><label htmlFor="sale-pay-destination">Destino</label><input id="sale-pay-destination" name="destination" defaultValue={sale.destination} maxLength={200} /></div>
        <div className="field"><label htmlFor="sale-carrier">Transportista (si es despacho)</label><input id="sale-carrier" name="carrier" maxLength={120} /></div>
      </div>
      {document === "factura" && <div className="field-grid">
        <div className="field"><label htmlFor="b-name">Razón social</label><input id="b-name" name="legalName" required /></div>
        <div className="field"><label htmlFor="b-rut">RUT</label><input id="b-rut" name="billingTaxId" required /></div>
        <div className="field"><label htmlFor="b-activity">Giro</label><input id="b-activity" name="activity" required /></div>
        <div className="field"><label htmlFor="b-address">Dirección tributaria</label><input id="b-address" name="address" required /></div>
        <div className="field"><label htmlFor="b-commune">Comuna</label><input id="b-commune" name="commune" required /></div>
        <div className="field"><label htmlFor="b-email">Correo de facturación</label><input id="b-email" name="billingEmail" type="email" required /></div>
        <div className="field"><label htmlFor="b-phone">Teléfono</label><input id="b-phone" name="billingPhone" /></div>
        <div className="field"><label htmlFor="b-po">Orden de compra</label><input id="b-po" name="purchaseOrder" /></div>
      </div>}
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{sale.status === "quote_accepted" ? "Crear pedido" : "Guardar"}</button>
    </form>}

    {sale.status === "payment_pending" && sale.paymentMethod === "transfer" && <form className="sale-subform" onSubmit={registerTransfer}>
      <h3>Registrar comprobante de transferencia</h3>
      <div className="field-grid">
        <div className="field"><label htmlFor="t-amount">Monto del comprobante</label><input id="t-amount" name="amount" type="number" min={0} required defaultValue={sale.total} /></div>
        <div className="field"><label htmlFor="t-payer">Pagador</label><input id="t-payer" name="payer" maxLength={160} /></div>
        <div className="field"><label htmlFor="t-date">Fecha</label><input id="t-date" name="paidOn" type="date" /></div>
        <div className="field"><label htmlFor="t-note">Nota</label><input id="t-note" name="note" maxLength={500} /></div>
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Registrar (queda en revisión)</button>
    </form>}
    <Feedback error={error} notice={notice} />
    <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Estado actual: {saleStatusLabels[sale.status]}.</p>
  </section>;
}

/** Aprobar o rechazar un comprobante en revisión (sólo administración). */
export function PaymentReview({ saleId, paymentId }: { saleId: string; paymentId: string }) {
  const { busy, error, notice, run } = useAction();
  const [note, setNote] = useState("");
  const review = (approve: boolean) => void run(() => send(`/api/admin/sales/${saleId}`, { action: "review", paymentId, approve, ...(note ? { note } : {}) }));
  return <div className="sale-inline">
    <input aria-label="Nota de revisión" placeholder="Nota (opcional)" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => review(true)}>Aprobar</button>
    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => review(false)}>Rechazar</button>
    <Feedback error={error} notice={notice} />
  </div>;
}
