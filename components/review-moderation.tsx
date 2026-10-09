"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

/** Botones para publicar o rechazar una reseña. */
export function ReviewModeration({ id, status }: { id: string; status: "pending" | "approved" | "rejected" }) {
  const router = useRouter();
  const [saving, setSaving] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState("");

  async function moderate(next: "approved" | "rejected") {
    setSaving(next); setError("");
    try {
      const response = await fetch(`/api/admin/reviews/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible guardar.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setSaving(null);
    }
  }

  return <div className="review-actions">
    {status !== "approved" && <button type="button" className="btn btn-primary btn-sm" disabled={saving !== null} onClick={() => moderate("approved")}><Check size={15} /> {saving === "approved" ? "Publicando…" : "Publicar"}</button>}
    {status !== "rejected" && <button type="button" className="btn btn-secondary btn-sm" disabled={saving !== null} onClick={() => moderate("rejected")}><X size={15} /> {status === "approved" ? "Despublicar" : "Rechazar"}</button>}
    {error && <span className="field-error" role="alert">{error}</span>}
  </div>;
}
