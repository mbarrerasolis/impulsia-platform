"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, UserRound } from "lucide-react";
import type { Contact } from "@/domain/crm/entities";

const ROLE_LABELS: Record<Contact["roles"][number], string> = {
  commercial: "Comercial",
  billing: "Facturación",
  technical: "Técnico",
  administrative: "Administrativo",
  management: "Dirección",
};
const ALL_ROLES = Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>;

function RoleCheckboxes({ selected, onToggle }: { selected: Contact["roles"]; onToggle: (role: Contact["roles"][number]) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px" }}>
      {ALL_ROLES.map((role) => (
        <label key={role} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={selected.includes(role)} onChange={() => onToggle(role)} style={{ width: 15 }} />
          {ROLE_LABELS[role]}
        </label>
      ))}
    </div>
  );
}

function EditContactForm({ contact, accountId, onDone }: { contact: Contact; accountId: string; onDone: () => void }) {
  const router = useRouter();
  const [roles, setRoles] = useState<Contact["roles"]>(contact.roles);
  const [isPrimaryBilling, setIsPrimaryBilling] = useState(contact.isPrimaryBilling ?? false);
  const [isActive, setIsActive] = useState(contact.isActive ?? true);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");

  function toggleRole(role: Contact["roles"][number]) {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  }

  async function save() {
    if (roles.length === 0) { setError("Selecciona al menos un rol."); return; }
    setStatus("saving"); setError("");
    try {
      const response = await fetch(`/api/admin/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, roles, isPrimaryBilling, isActive }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible actualizar el contacto.");
      router.refresh();
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
      setStatus("idle");
    }
  }

  return (
    <div style={{ padding: "14px 0", borderTop: "1px solid var(--line)" }}>
      <RoleCheckboxes selected={roles} onToggle={toggleRole} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={isPrimaryBilling} onChange={(event) => setIsPrimaryBilling(event.target.checked)} style={{ width: 15 }} />
          Contacto principal de facturación
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} style={{ width: 15 }} />
          Activo
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 34 }} onClick={save} disabled={status === "saving"}>{status === "saving" ? "Guardando..." : "Guardar"}</button>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 34 }} onClick={onDone} disabled={status === "saving"}>Cancelar</button>
      </div>
    </div>
  );
}

function AddContactForm({ accountId, onDone }: { accountId: string; onDone: () => void }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [roles, setRoles] = useState<Contact["roles"]>([]);
  const [isPrimaryBilling, setIsPrimaryBilling] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState("");

  function toggleRole(role: Contact["roles"][number]) {
    setRoles((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  }

  async function save() {
    if (roles.length === 0) { setError("Selecciona al menos un rol."); return; }
    setStatus("saving"); setError("");
    try {
      const response = await fetch(`/api/admin/accounts/${accountId}/contacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, jobTitle, roles, isPrimaryBilling }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No fue posible crear el contacto.");
      router.refresh();
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.");
      setStatus("idle");
    }
  }

  return (
    <div style={{ padding: "16px 0", borderTop: "1px solid var(--line)" }}>
      <div className="field-grid">
        <div className="field"><label>Nombre</label><input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Ej. Camila" /></div>
        <div className="field"><label>Apellido</label><input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Ej. Rojas" /></div>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="camila@empresa.cl" /></div>
        <div className="field"><label>Cargo (opcional)</label><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Ej. Administración" /></div>
      </div>
      <div style={{ marginTop: 6 }}><RoleCheckboxes selected={roles} onToggle={toggleRole} /></div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, marginTop: 12 }}>
        <input type="checkbox" checked={isPrimaryBilling} onChange={(event) => setIsPrimaryBilling(event.target.checked)} style={{ width: 15 }} />
        Contacto principal de facturación
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 34 }} onClick={save} disabled={status === "saving"}>{status === "saving" ? "Guardando..." : "Crear contacto"}</button>
        <button type="button" className="btn btn-secondary" style={{ minHeight: 34 }} onClick={onDone} disabled={status === "saving"}>Cancelar</button>
      </div>
    </div>
  );
}

export function ContactsPanel({ accountId, contacts, editable }: { accountId: string; contacts: Contact[]; editable: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <article className="card panel">
      <div className="panel-head">
        <h2>Contactos</h2>
        {editable && <button type="button" className="btn btn-secondary" style={{ minHeight: 34 }} onClick={() => setAdding((current) => !current)}>{adding ? "Cerrar" : "Agregar"}</button>}
      </div>
      {contacts.length ? contacts.map((contact) => (
        <div key={contact.id}>
          <div className="pipeline-row" style={{ gridTemplateColumns: editable ? "1fr 1fr auto auto" : "1fr 1fr auto" }}>
            <span><UserRound size={15} style={{ verticalAlign: "middle", marginRight: 8 }} /><strong>{contact.firstName} {contact.lastName}</strong>{contact.isPrimaryBilling && <span className="state active" style={{ marginLeft: 8 }}>● Facturación</span>}{contact.isActive === false && <span className="state" style={{ marginLeft: 8 }}>Inactivo</span>}<br /><small className="muted">{contact.jobTitle}</small></span>
            <span><Mail size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />{contact.email}</span>
            <span>{contact.roles.map((role) => ROLE_LABELS[role]).join(", ")}</span>
            {editable && <button type="button" className="btn btn-secondary" style={{ minHeight: 30, padding: "0 10px" }} onClick={() => setEditingId((current) => (current === contact.id ? null : contact.id))}>{editingId === contact.id ? "Cerrar" : "Editar"}</button>}
          </div>
          {editingId === contact.id && <EditContactForm contact={contact} accountId={accountId} onDone={() => setEditingId(null)} />}
        </div>
      )) : <p className="muted">Esta cuenta aún no tiene contactos cargados.</p>}
      {adding && <AddContactForm accountId={accountId} onDone={() => setAdding(false)} />}
    </article>
  );
}
