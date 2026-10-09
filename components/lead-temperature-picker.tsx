"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { temperatureLabels, type LeadTemperature, type LeadTemperatureView } from "@/domain/crm/lead-temperature";

const options: LeadTemperature[] = ["hot", "warm", "cold"];

/** Selector de temperatura en la ficha del lead; guarda y refresca la página. */
export function LeadTemperaturePicker({ leadId, current }: { leadId: string; current: LeadTemperatureView }) {
  const router = useRouter();
  const [saving, setSaving] = useState<LeadTemperature | null>(null);
  const [error, setError] = useState("");

  async function choose(temperature: LeadTemperature) {
    if (temperature === current || saving) return;
    setSaving(temperature);
    setError("");
    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ temperature }) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? "No fue posible guardar.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="temp-picker" role="group" aria-label="Temperatura del lead">
        {options.map((option) => (
          <button key={option} type="button" className={`temp-chip temp-${option}${current === option ? " selected" : ""}`} aria-pressed={current === option} disabled={Boolean(saving)} onClick={() => choose(option)}>
            <span className="temp-dot" aria-hidden />{saving === option ? "Guardando…" : temperatureLabels[option]}
          </button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
