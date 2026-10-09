"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, PackagePlus, Pencil, Upload, X } from "lucide-react";
import { movementKindLabels, movementKinds, stockStatusLabels, type MovementKind, type StockStatus } from "@/domain/storefront/inventory";

export interface InventoryRowData {
  variantKey: string;
  productName: string;
  formatLabel: string;
  categoryName?: string;
  categoryColor?: string;
  sku?: string;
  /** Código del producto en la lista del cliente (todas sus presentaciones). */
  productCode?: string;
  price?: number;
  priceLabel: string;
  /** El precio sale de la lista por kilo (tramo base); un precio aquí lo reemplaza. */
  fromList?: boolean;
  active: boolean;
  trackStock: boolean;
  stock: number;
  lowStockThreshold: number;
  status: StockStatus;
}

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as { error?: string; issues?: Array<{ message: string }> };
  if (!response.ok) throw new Error(result.issues?.[0]?.message ?? result.error ?? "No fue posible guardar.");
}

const stateClass: Record<StockStatus, string> = { untracked: "", in_stock: "active", low: "paused", out: "danger" };

/** Fila del inventario; quien puede editar la abre para cambiar datos o mover stock. */
export function InventoryRow({ row, canEdit }: { row: InventoryRowData; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState(row.sku ?? "");
  const [price, setPrice] = useState(row.price ? String(row.price) : "");
  const [active, setActive] = useState(row.active);
  const [threshold, setThreshold] = useState(String(row.lowStockThreshold));
  const [kind, setKind] = useState<MovementKind>("purchase");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"data" | "stock" | null>(null);
  const [error, setError] = useState("");

  async function run(task: "data" | "stock", action: () => Promise<void>) {
    setBusy(task); setError("");
    try {
      await action();
      router.refresh();
      if (task === "stock") { setQuantity(""); setNote(""); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setBusy(null);
    }
  }

  const saveData = (event: React.FormEvent) => {
    event.preventDefault();
    void run("data", () => send("/api/admin/inventory/variants", "PATCH", {
      variantKey: row.variantKey,
      sku: sku.trim() || null,
      price: price ? Number(price) : null,
      active,
      lowStockThreshold: Number(threshold || 0),
    }));
  };
  const saveMovement = (event: React.FormEvent) => {
    event.preventDefault();
    void run("stock", () => send("/api/admin/inventory/movements", "POST", { variantKey: row.variantKey, kind, quantity: Number(quantity), note: note.trim() || undefined }));
  };
  const id = row.variantKey.replace(/[^a-z0-9]+/gi, "-");

  return <>
    <tr data-inactive={!row.active || undefined}>
      <td>
        <strong><span className="inv-dot" style={{ background: row.categoryColor }} aria-hidden="true" />{row.productName}</strong>
        {row.categoryName && <span className="muted lead-sub">{row.categoryName}</span>}
      </td>
      <td>{row.formatLabel || "—"}</td>
      <td className="inv-sku">{row.sku ?? (row.productCode ? <span className="muted" title="Código del producto en la lista">{row.productCode}</span> : <span className="muted">—</span>)}</td>
      <td className="num">{row.price ? row.priceLabel : row.fromList ? <span title="Calculado desde la lista por kilo, con IVA">{row.priceLabel} <small className="muted">lista</small></span> : <span className="muted">Sin precio</span>}</td>
      <td className="num">{row.trackStock ? row.stock.toLocaleString("es-CL") : <span className="muted">—</span>}</td>
      <td>{row.active ? <span className={`state ${stateClass[row.status]}`}>{stockStatusLabels[row.status]}</span> : <span className="state">No se vende</span>}</td>
      <td className="num">{canEdit && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`inv-${id}`}>
        {open ? <><X size={14} /> Cerrar</> : <><Pencil size={14} /> Editar</>}
      </button>}</td>
    </tr>
    {open && <tr className="inv-edit" id={`inv-${id}`}>
      <td colSpan={7}>
        <div className="inv-edit-grid">
          <form onSubmit={saveData} aria-label={`Datos de ${row.productName} ${row.formatLabel}`}>
            <h3>Datos de venta</h3>
            <div className="inv-fields">
              <label><span>SKU</span><input value={sku} onChange={(event) => setSku(event.target.value)} maxLength={40} placeholder="Código del ERP" /></label>
              <label><span>Precio (con IVA)</span><input type="number" min="1" step="1" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} placeholder={row.fromList ? `Lista: ${row.priceLabel}` : "A consultar"} /></label>
              <label><span>Avisar stock bajo desde</span><input type="number" min="0" step="1" inputMode="numeric" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
              <label className="inv-check"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Se vende en el sitio</label>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy !== null}>{busy === "data" ? "Guardando…" : "Guardar datos"}</button>
          </form>
          <form onSubmit={saveMovement} aria-label={`Stock de ${row.productName} ${row.formatLabel}`}>
            <h3>Movimiento de stock {row.trackStock && <span className="muted">· hay {row.stock}</span>}</h3>
            <div className="inv-fields">
              <label><span>Tipo</span><select value={kind} onChange={(event) => setKind(event.target.value as MovementKind)}>{movementKinds.map((value) => <option key={value} value={value}>{movementKindLabels[value]}</option>)}</select></label>
              <label><span>{kind === "count" ? "Unidades contadas" : "Unidades"}</span><input type="number" min={kind === "count" ? 0 : 1} step="1" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
              <label className="inv-wide"><span>Nota (opcional)</span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="Ej.: factura 1234 del proveedor" /></label>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy !== null}><PackagePlus size={14} /> {busy === "stock" ? "Registrando…" : "Registrar"}</button>
          </form>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </td>
    </tr>}
  </>;
}

/** Descargar la planilla, completarla en Excel y cargarla de vuelta. */
export function InventorySheet({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function upload(file: File) {
    setBusy(true); setMessage(""); setErrors([]);
    try {
      const response = await fetch("/api/admin/inventory/sheet", { method: "POST", headers: { "content-type": "text/csv" }, body: await file.text() });
      const result = await response.json() as { error?: string; errors?: string[]; updated?: number; movements?: number };
      if (!response.ok) { setMessage(result.error ?? "No fue posible cargar la planilla."); setErrors(result.errors ?? []); return; }
      setMessage(`Listo: ${result.updated} presentaciones actualizadas${result.movements ? ` y ${result.movements} ajustes de stock` : ""}.`);
      router.refresh();
    } catch {
      setMessage("No fue posible cargar la planilla.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return <div className="inv-sheet">
    <a className="btn btn-secondary btn-sm" href="/api/admin/inventory/sheet" download><Download size={15} /> Descargar planilla</a>
    {canEdit && <>
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} /> {busy ? "Cargando…" : "Cargar planilla"}</button>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    </>}
    {message && <p className={errors.length || !message.startsWith("Listo") ? "form-error" : "form-success"} role="status">{message}</p>}
    {errors.length > 0 && <ul className="inv-errors">{errors.map((item) => <li key={item}>{item}</li>)}</ul>}
  </div>;
}
