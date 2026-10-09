"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";

export function ManualPaymentButton({ periodId, status, enabled = true }: { periodId: string; status: string; enabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (status === "paid" || !enabled) return null;

  async function save() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/billing/${periodId}/manual-payment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible registrar el pago.");
      router.refresh();
      setOpen(false);
      setReference("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return <button type="button" className="btn btn-secondary" style={{ minHeight: 34, padding: "0 11px" }} onClick={() => setOpen(true)}><CheckCircle2 size={14} /> Pago manual</button>;
  }

  return (
    <div className="card" style={{ padding: 14, width: 260 }}>
      <div className="field" style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12 }}>Evidencia (banco, N° de transferencia o comprobante)</label>
        <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. BancoEstado, transferencia #48213" />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 32, padding: "0 10px" }} onClick={save} disabled={saving}>{saving ? <LoaderCircle size={14} /> : "Confirmar pago"}</button>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 32, padding: "0 10px" }} onClick={() => setOpen(false)} disabled={saving}>Cancelar</button>
      </div>
    </div>
  );
}
