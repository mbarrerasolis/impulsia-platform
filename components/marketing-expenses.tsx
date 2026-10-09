"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { expenseCategories, expenseCurrencies, type ExpenseCategory, type ExpenseCurrency } from "@/domain/marketing/expenses";
import { leadChannels, type LeadChannel } from "@/domain/marketing/lead-channel";

export function ExpenseForm({ today, defaultCurrency, campaigns }: { today: string; defaultCurrency: ExpenseCurrency; campaigns: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [spentOn, setSpentOn] = useState(today);
  const [category, setCategory] = useState<ExpenseCategory>("advertising");
  const [channel, setChannel] = useState<LeadChannel | "">("instagram");
  const [campaign, setCampaign] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<ExpenseCurrency>(defaultCurrency);
  const [recurrence, setRecurrence] = useState<"once" | "monthly">("once");
  const [endsOn, setEndsOn] = useState("");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const adMetrics = recurrence === "once" && category === "advertising";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/admin/marketing/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spentOn, category, channel, campaign, description, amount, currency, recurrence, endsOn: recurrence === "monthly" ? endsOn : "", impressions: adMetrics ? impressions : "", clicks: adMetrics ? clicks : "" }),
      });
      const result = await response.json() as { error?: string; issues?: Array<{ message: string }> };
      if (!response.ok) throw new Error(result.issues?.[0]?.message ?? result.error ?? "No fue posible registrar el gasto.");
      setDescription(""); setAmount(""); setCampaign(""); setImpressions(""); setClicks("");
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={15} /> Registrar gasto</button>;

  return (
    <form onSubmit={save} className="expense-form">
      <div className="field-grid">
        <div className="field"><label htmlFor="expense-description">Descripción</label><input id="expense-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej.: Anuncios Instagram semana 1" required maxLength={200} /></div>
        <div className="field"><label htmlFor="expense-amount">Monto</label><input id="expense-amount" type="number" min="1" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
        <div className="field"><label htmlFor="expense-currency">Moneda</label><select id="expense-currency" value={currency} onChange={(event) => setCurrency(event.target.value as ExpenseCurrency)}>{expenseCurrencies.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
        <div className="field"><label htmlFor="expense-date">Fecha</label><input id="expense-date" type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} required /></div>
        <div className="field"><label htmlFor="expense-category">Tipo</label><select id="expense-category" value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}>{Object.entries(expenseCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="field"><label htmlFor="expense-channel">Procedencia</label><select id="expense-channel" value={channel} onChange={(event) => setChannel(event.target.value as LeadChannel | "")}><option value="">General (sin canal)</option>{Object.entries(leadChannels).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></div>
        <div className="field"><label htmlFor="expense-campaign">Campaña (utm_campaign)</label><input id="expense-campaign" list="expense-campaigns" value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Opcional" maxLength={150} /><datalist id="expense-campaigns">{campaigns.map((value) => <option key={value} value={value} />)}</datalist></div>
        <div className="field"><label htmlFor="expense-recurrence">Frecuencia</label><select id="expense-recurrence" value={recurrence} onChange={(event) => setRecurrence(event.target.value as "once" | "monthly")}><option value="once">Gasto único</option><option value="monthly">Mensual (se repite)</option></select></div>
        {adMetrics && <>
          <div className="field"><label htmlFor="expense-impressions">Visualizaciones</label><input id="expense-impressions" type="number" min="0" step="1" inputMode="numeric" value={impressions} onChange={(event) => setImpressions(event.target.value)} placeholder="Impresiones del anuncio" /></div>
          <div className="field"><label htmlFor="expense-clicks">Clics</label><input id="expense-clicks" type="number" min="0" step="1" inputMode="numeric" value={clicks} onChange={(event) => setClicks(event.target.value)} placeholder="Clics en el enlace" /></div>
        </>}
        {recurrence === "monthly" && <div className="field"><label htmlFor="expense-ends">Hasta (opcional)</label><input id="expense-ends" type="date" value={endsOn} min={spentOn} onChange={(event) => setEndsOn(event.target.value)} /></div>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Guardando..." : "Guardar gasto"}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)} disabled={saving}>Cancelar</button>
      </div>
    </form>
  );
}

export function DeleteExpenseButton({ id, description }: { id: string; description: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/marketing/expenses/${id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible eliminar el gasto.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
      setBusy(false);
    }
  }

  if (!confirming) return <button type="button" className="btn btn-secondary btn-sm" aria-label={`Eliminar ${description}`} onClick={() => setConfirming(true)}><Trash2 size={14} /></button>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <button type="button" className="btn btn-primary btn-sm" onClick={remove} disabled={busy}>{busy ? "..." : "Eliminar"}</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirming(false)} disabled={busy}>No</button>
      {error && <span className="form-error" role="alert">{error}</span>}
    </span>
  );
}

/** Importa en el momento el gasto de Meta Ads (lo mismo que hace la tarea diaria). */
export function MetaSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function sync() {
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/admin/marketing/meta-sync", { method: "POST" });
      const result = await response.json() as { error?: string; saved?: number; since?: string; until?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible sincronizar con Meta.");
      setMessage(result.saved ? `${result.saved} gastos actualizados (${result.since} a ${result.until}).` : `Sin gasto en Meta entre ${result.since} y ${result.until}.`);
      router.refresh();
    } catch (cause) {
      setFailed(true);
      setMessage(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={sync} disabled={busy}><RefreshCw size={14} /> {busy ? "Sincronizando…" : "Sincronizar con Meta"}</button>
      {message && <span className={failed ? "form-error" : "muted"} role={failed ? "alert" : "status"}>{message}</span>}
    </span>
  );
}
