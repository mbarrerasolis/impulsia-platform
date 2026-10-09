"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import type { ImplementationTaskRecord } from "@/domain/operations/entities";
import type { InternalProfileSummary } from "@/repositories/read-model-repository";

const STATUS_LABELS: Record<ImplementationTaskRecord["status"], string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  done: "Hecha",
  blocked: "Bloqueada",
};
const STATUSES = Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>;

function AssigneeSelect({ profiles, value, onChange }: { profiles: InternalProfileSummary[]; value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Sin asignar</option>
      {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
    </select>
  );
}

function EditTaskForm({ task, profiles, onDone }: { task: ImplementationTaskRecord; profiles: InternalProfileSummary[]; onDone: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState(task.status);
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [actualHours, setActualHours] = useState(task.actualHours != null ? String(task.actualHours) : "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, assignee, dueDate, actualHours: actualHours === "" ? undefined : Number(actualHours) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible actualizar la tarea.");
      router.refresh();
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
      <div className="field-grid">
        <div className="field"><label>Estado</label><select value={status} onChange={(event) => setStatus(event.target.value as ImplementationTaskRecord["status"])}>{STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}</select></div>
        <div className="field"><label>Responsable</label><AssigneeSelect profiles={profiles} value={assignee} onChange={setAssignee} /></div>
        <div className="field"><label>Horas reales</label><input type="number" min="0" step="0.5" value={actualHours} onChange={(event) => setActualHours(event.target.value)} /></div>
        <div className="field"><label>Vencimiento</label><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 32 }} onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 32 }} onClick={onDone} disabled={saving}>Cancelar</button>
      </div>
    </div>
  );
}

function AddTaskForm({ clientSolutionId, profiles, onDone }: { clientSolutionId: string; profiles: InternalProfileSummary[]; onDone: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [estimateHours, setEstimateHours] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/solutions/${clientSolutionId}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, assignee, dueDate, estimateHours: estimateHours === "" ? undefined : Number(estimateHours) }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible crear la tarea.");
      router.refresh();
      onDone();
      setTitle(""); setAssignee(""); setEstimateHours(""); setDueDate("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "16px 0", borderTop: "1px solid var(--line)" }}>
      <div className="field full"><label>Tarea</label><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Configurar webhook de facturación" /></div>
      <div className="field-grid" style={{ marginTop: 6 }}>
        <div className="field"><label>Responsable (opcional)</label><AssigneeSelect profiles={profiles} value={assignee} onChange={setAssignee} /></div>
        <div className="field"><label>Horas estimadas (opcional)</label><input type="number" min="0" step="0.5" value={estimateHours} onChange={(event) => setEstimateHours(event.target.value)} /></div>
        <div className="field"><label>Vencimiento (opcional)</label><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 32 }} onClick={save} disabled={saving || title.trim().length < 2}>{saving ? "Guardando..." : "Crear tarea"}</button>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 32 }} onClick={onDone} disabled={saving}>Cancelar</button>
      </div>
    </div>
  );
}

export function TasksPanel({ clientSolutionId, tasks, profiles, editable }: { clientSolutionId: string; tasks: ImplementationTaskRecord[]; profiles: InternalProfileSummary[]; editable: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <article className="card panel">
      <div className="panel-head">
        <h2><ListChecks size={17} style={{ verticalAlign: "middle", marginRight: 8 }} />Tareas de implementación</h2>
        {editable && <button type="button" className="btn btn-secondary" style={{ minHeight: 34 }} onClick={() => setAdding((current) => !current)}>{adding ? "Cerrar" : "Agregar"}</button>}
      </div>
      {tasks.length ? tasks.map((task) => (
        <div key={task.id}>
          <div className="pipeline-row" style={{ gridTemplateColumns: editable ? "1fr auto auto auto auto" : "1fr auto auto auto" }}>
            <span><strong>{task.title}</strong>{task.dueDate && <><br /><small className="muted">Vence {task.dueDate}</small></>}</span>
            <span className={`state ${task.status === "done" ? "active" : task.status === "blocked" ? "paused" : ""}`}>● {STATUS_LABELS[task.status]}</span>
            <span className="muted">{task.assigneeName ?? "Sin asignar"}</span>
            <span className="muted">{task.actualHours ?? 0}{task.estimateHours ? ` / ${task.estimateHours}` : ""} h</span>
            {editable && <button type="button" className="btn btn-secondary" style={{ minHeight: 30, padding: "0 10px" }} onClick={() => setEditingId((current) => (current === task.id ? null : task.id))}>{editingId === task.id ? "Cerrar" : "Editar"}</button>}
          </div>
          {editingId === task.id && <EditTaskForm task={task} profiles={profiles} onDone={() => setEditingId(null)} />}
        </div>
      )) : <p className="muted">Esta solución aún no tiene tareas registradas.</p>}
      {adding && <AddTaskForm clientSolutionId={clientSolutionId} profiles={profiles} onDone={() => setAdding(false)} />}
    </article>
  );
}
