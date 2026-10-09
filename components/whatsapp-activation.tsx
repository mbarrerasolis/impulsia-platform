"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, ShieldCheck } from "lucide-react";

interface PhoneStatus {
  display_phone_number?: string;
  verified_name?: string;
  code_verification_status?: string;
  name_status?: string;
  status?: string;
  platform_type?: string;
}

/** Activa el número en la API de WhatsApp desde el panel; el token nunca sale del servidor. */
export function WhatsAppActivation() {
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [phone, setPhone] = useState<PhoneStatus>();
  const [done, setDone] = useState(false);

  async function call(method: "GET" | "POST") {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/admin/whatsapp/activate", {
        method,
        headers: { "content-type": "application/json" },
        ...(method === "POST" ? { body: JSON.stringify({ pin }) } : {}),
      });
      const data = await response.json() as { error?: string; phone?: PhoneStatus };
      if (!response.ok) throw new Error(data.error ?? "No fue posible completar la operación.");
      setPhone(data.phone);
      if (method === "POST") { setDone(true); setPin(""); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No fue posible completar la operación.");
    } finally {
      setPending(false);
    }
  }

  function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (/^\d{6}$/.test(pin)) void call("POST");
  }

  return (
    <div style={{ marginTop: 16 }}>
      <form className="bot-composer" onSubmit={activate} style={{ gap: 8 }}>
        <label className="sr-only" htmlFor="whatsapp-pin">PIN de 6 dígitos</label>
        <input id="whatsapp-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="Elige un PIN de 6 dígitos" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} />
        <button className="btn btn-primary" type="submit" disabled={pending || pin.length !== 6}>{pending ? <LoaderCircle size={16}/> : <ShieldCheck size={16}/>} Activar número</button>
        <button className="btn" type="button" disabled={pending} onClick={() => void call("GET")}>Ver estado</button>
      </form>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>El PIN protege el número (verificación en dos pasos de WhatsApp). Guárdalo: Meta lo pide si el número se vuelve a registrar.</p>
      {error && <p className="bot-simulator-result" role="alert">{error}</p>}
      {done && <p className="bot-simulator-result">Número registrado y cuenta conectada a la app.</p>}
      {phone && (
        <div className="bot-lead-preview">
          <strong>{phone.display_phone_number} · {phone.verified_name}</strong>
          <span>Estado: {phone.status ?? "—"} · Verificación: {phone.code_verification_status ?? "—"} · Nombre: {phone.name_status ?? "—"} · Plataforma: {phone.platform_type ?? "—"}</span>
        </div>
      )}
    </div>
  );
}
