"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Check, LoaderCircle } from "lucide-react";
import { marketingSignals, readAttribution, trackMetaEvent } from "@/lib/marketing/browser";
import { TurnstileWidget } from "./turnstile-widget";

export function DiagnosticForm({ brandName, contactHref, turnstileSiteKey }: { brandName: string; contactHref: string; turnstileSiteKey?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const mountedAt = useRef(0);
  useEffect(() => { mountedAt.current = Date.now(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (turnstileSiteKey && !captchaToken) { setError("Espera a que termine la verificación de seguridad antes de enviar."); return; }
    setStatus("sending"); setError("");
    const data = new FormData(event.currentTarget);
    const payload = {
      website: data.get("website") ?? "", elapsedMs: Date.now() - mountedAt.current, captchaToken: captchaToken || undefined,
      name: data.get("name"), company: data.get("company"), email: data.get("email"), phone: data.get("phone"),
      rawNeedDescription: data.get("rawNeedDescription"),
      systems: String(data.get("systems") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      apiKnowledge: data.get("apiKnowledge") || "unknown",
      peopleInvolved: Number(data.get("peopleInvolved")) || undefined,
      hoursPerMonth: Number(data.get("hoursPerMonth")) || undefined,
      monthlyVolume: Number(data.get("monthlyVolume")) || undefined,
      primaryGoal: data.get("primaryGoal"), consentGiven: data.get("consentGiven") === "on",
      attribution: readAttribution(), marketing: marketingSignals()
    };
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; id?: string };
      if (!response.ok) throw new Error(result.error ?? "No pudimos enviar el diagnóstico.");
      // Mismo id que el evento de servidor (Conversions API) para que Meta no lo cuente dos veces.
      trackMetaEvent("Lead", result.id);
      setStatus("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocurrió un error inesperado.");
      setStatus("idle");
      // El token de Turnstile ya se consumió en el intento fallido.
      if (turnstileSiteKey) setCaptchaResetKey((value) => value + 1);
    }
  }

  if (status === "success") {
    return <div className="card form-shell"><div className="lead-form"><div className="success-box"><span className="success-icon"><Check size={32}/></span><h2>Diagnóstico recibido</h2><p className="muted">Ya tenemos el contexto inicial. Revisaremos el proceso y te contactaremos para validar alcance, integraciones y próximos pasos.</p><div className="hero-actions" style={{justifyContent:"center"}}><Link href="/" className="btn btn-secondary">Volver al inicio</Link><a href={contactHref} className="btn btn-primary">Agendar reunión</a></div></div></div></div>;
  }

  return <div className="card form-shell">
    <form className="lead-form" onSubmit={submit}>
      <div className="form-step">
        <h2>Cuéntanos lo básico</h2>
        <p>Con esto ya podemos contactarte. Todo lo demás es opcional.</p>
        <div className="field-grid">
          <div className="field"><label htmlFor="name">Nombre y apellido</label><input id="name" name="name" required minLength={2} autoComplete="name" placeholder="Ej. Camila Rojas"/></div>
          <div className="field"><label htmlFor="company">Empresa</label><input id="company" name="company" required minLength={2} autoComplete="organization" placeholder="Ej. Andina Logística"/></div>
          <div className="field"><label htmlFor="email">Email de trabajo</label><input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@empresa.cl"/></div>
          <div className="field"><label htmlFor="phone">Teléfono (opcional)</label><input id="phone" name="phone" autoComplete="tel" placeholder="+56 9..."/></div>
        </div>
        <div className="field full">
          <label htmlFor="rawNeedDescription">¿Qué te gustaría mejorar o automatizar? (opcional)</label>
          <textarea id="rawNeedDescription" name="rawNeedDescription" placeholder="Ej. Hoy pasamos los pedidos del correo al ERP a mano..."/>
          <span className="field-hint">Si prefieres, lo conversamos directamente en la llamada.</span>
        </div>
        <div className="field">
          <label htmlFor="primaryGoal">Objetivo principal</label>
          <select id="primaryGoal" name="primaryGoal" required defaultValue=""><option value="" disabled>Selecciona una opción</option><option>Ahorrar tiempo operativo</option><option>Reducir errores</option><option>Responder más rápido</option><option>Vender más</option><option>Mejorar visibilidad y control</option><option>Otro</option></select>
        </div>

        <details className="details-toggle">
          <summary>Cuéntanos más para afinar el diagnóstico (opcional) <ChevronDown size={16} className="chevron"/></summary>
          <div className="details-toggle-body">
            <div className="field"><label htmlFor="systems">Sistemas involucrados</label><input id="systems" name="systems" placeholder="ERP, Gmail, Excel (separados por coma)"/></div>
            <div className="field-grid" style={{marginTop:14}}>
              <div className="field"><label htmlFor="apiKnowledge">¿Sabes si tienen API?</label><select id="apiKnowledge" name="apiKnowledge" defaultValue="unknown"><option value="unknown">No lo sé</option><option value="yes">Sí</option><option value="no">No</option></select></div>
              <div className="field"><label htmlFor="peopleInvolved">Personas involucradas</label><input id="peopleInvolved" name="peopleInvolved" type="number" min="0" placeholder="Ej. 4"/></div>
              <div className="field"><label htmlFor="hoursPerMonth">Horas dedicadas al mes</label><input id="hoursPerMonth" name="hoursPerMonth" type="number" min="0" step="0.5" placeholder="Ej. 60"/></div>
              <div className="field"><label htmlFor="monthlyVolume">Casos o transacciones al mes</label><input id="monthlyVolume" name="monthlyVolume" type="number" min="0" placeholder="Ej. 500"/></div>
            </div>
          </div>
        </details>

        <div className="field"><label style={{display:"flex",gap:10,alignItems:"flex-start",fontWeight:500}}><input name="consentGiven" type="checkbox" required style={{width:17,marginTop:2}}/>Acepto que {brandName} me contacte para responder este diagnóstico. Mis datos no se usarán para envíos ajenos a esta solicitud.</label></div>
        <div className="form-trap" aria-hidden="true"><label htmlFor="website">Sitio web</label><input id="website" name="website" tabIndex={-1} autoComplete="off"/></div>
        {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onToken={setCaptchaToken} resetKey={captchaResetKey}/>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions" style={{justifyContent:"flex-end"}}><button className="btn btn-primary" type="submit" disabled={status==="sending"}>{status === "sending" ? <LoaderCircle size={17}/> : "Enviar diagnóstico"}</button></div>
    </form>
  </div>;
}
