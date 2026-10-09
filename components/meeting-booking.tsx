"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, LoaderCircle } from "lucide-react";
import { marketingSignals, readAttribution, trackMetaEvent } from "@/lib/marketing/browser";
import { TurnstileWidget } from "./turnstile-widget";

interface Slot { start: string; label: string }
interface SlotsResponse { available: boolean; timeZone?: string; meetingMinutes?: number; slots: Slot[] }
interface Booked { slotLabel: string; meetLink?: string }

const fallbackTimeZone = "America/Santiago";

function groupByDay(slots: Slot[], timeZone: string) {
  const day = new Intl.DateTimeFormat("es-CL", { timeZone, weekday: "long", day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat("es-CL", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const groups = new Map<string, { start: string; time: string }[]>();
  for (const slot of slots) {
    const date = new Date(slot.start);
    const key = day.format(date);
    groups.set(key, [...(groups.get(key) ?? []), { start: slot.start, time: time.format(date) }]);
  }
  return [...groups.entries()].map(([label, times]) => ({ label, times }));
}

export function MeetingBooking({ contactHref, whatsappHref, turnstileSiteKey, defaultCompany = "", defaultTopic = "" }: {
  contactHref: string;
  whatsappHref?: string;
  turnstileSiteKey?: string;
  defaultCompany?: string;
  defaultTopic?: string;
}) {
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [booked, setBooked] = useState<Booked | null>(null);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const mountedAt = useRef(0);

  useEffect(() => {
    mountedAt.current = Date.now();
    fetch("/api/meetings", { cache: "no-store" })
      .then((response) => response.json() as Promise<SlotsResponse>)
      .then(setData)
      .catch(() => setData({ available: false, slots: [] }));
  }, []);

  const timeZone = data?.timeZone ?? fallbackTimeZone;
  const days = useMemo(() => groupByDay(data?.slots ?? [], timeZone), [data, timeZone]);
  const selectedLabel = data?.slots.find((slot) => slot.start === selected)?.label;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) { setError("Elige un horario para la reunión."); return; }
    if (turnstileSiteKey && !captchaToken) { setError("Espera a que termine la verificación de seguridad antes de enviar."); return; }
    setStatus("sending"); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      website: form.get("website") ?? "", elapsedMs: Date.now() - mountedAt.current, captchaToken: captchaToken || undefined,
      name: form.get("name"), company: form.get("company"), email: form.get("email"), phone: form.get("phone"),
      topic: form.get("topic"), start: selected, consentGiven: form.get("consentGiven") === "on",
      attribution: readAttribution(), marketing: marketingSignals(),
    };
    try {
      const response = await fetch("/api/meetings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string; id?: string; slotLabel?: string; meetLink?: string; slots?: Slot[] };
      if (response.status === 409 && result.slots) {
        setData((current) => ({ ...(current ?? { available: true }), slots: result.slots ?? [] }));
        setSelected(""); setDayIndex(0);
      }
      if (!response.ok) throw new Error(result.error ?? "No pudimos agendar la reunión.");
      // Mismo id que el evento de servidor (Conversions API) para que Meta no lo cuente dos veces.
      trackMetaEvent("Schedule", result.id);
      setBooked({ slotLabel: result.slotLabel ?? selectedLabel ?? "", meetLink: result.meetLink });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocurrió un error inesperado.");
      if (turnstileSiteKey) setCaptchaResetKey((value) => value + 1);
    } finally {
      setStatus("idle");
    }
  }

  if (booked) {
    return <div className="card form-shell"><div className="lead-form"><div className="success-box">
      <span className="success-icon"><CalendarCheck size={32}/></span>
      <h2>¡Reunión agendada!</h2>
      <p className="muted">Nos vemos el <strong>{booked.slotLabel}</strong> por Google Meet. Te llegó la invitación a tu correo; acéptala para que quede en tu calendario.</p>
      {booked.meetLink && <p><a className="btn btn-primary" href={booked.meetLink} target="_blank" rel="noreferrer">Enlace de la videollamada</a></p>}
      <p className="muted">¿Necesitas cambiar el horario? Responde la invitación o escríbenos.</p>
    </div></div></div>;
  }

  if (data && (!data.available || data.slots.length === 0)) {
    return <div className="card form-shell"><div className="lead-form"><div className="success-box">
      <h2>Coordinemos por otro medio</h2>
      <p className="muted">{data.available ? "No quedan horarios libres esta semana." : "La agenda en línea no está disponible en este momento."} Escríbenos y te proponemos un horario.</p>
      <div className="hero-actions" style={{ justifyContent: "center" }}>
        {whatsappHref && <a className="btn btn-primary" href={whatsappHref} target="_blank" rel="noreferrer">Escribir por WhatsApp</a>}
        <a className="btn btn-secondary" href={contactHref}>Escribir por correo</a>
      </div>
    </div></div></div>;
  }

  const activeDay = days[Math.min(dayIndex, Math.max(days.length - 1, 0))];
  return <div className="card form-shell">
    <form className="lead-form" onSubmit={submit}>
      <div className="form-step">
        <h2>1. Elige un horario</h2>
        <p>Videollamada de {data?.meetingMinutes ?? 30} minutos por Google Meet, sin costo ni compromiso. Hora de Chile continental.</p>
        {!data ? <p className="muted booking-loading"><LoaderCircle size={18}/> Buscando horarios libres…</p> : <>
          <div className="booking-days" role="tablist" aria-label="Días disponibles">
            {days.map((day, index) => <button key={day.label} type="button" role="tab" aria-selected={day === activeDay} className={`booking-chip${day === activeDay ? " is-active" : ""}`} onClick={() => setDayIndex(index)}>{day.label}</button>)}
          </div>
          <div className="booking-times" role="radiogroup" aria-label={`Horarios del ${activeDay?.label ?? ""}`}>
            {activeDay?.times.map((slot) => <button key={slot.start} type="button" role="radio" aria-checked={selected === slot.start} className={`booking-chip${selected === slot.start ? " is-selected" : ""}`} onClick={() => { setSelected(slot.start); setError(""); }}>{slot.time}</button>)}
          </div>
          {selectedLabel && <p className="booking-picked">Elegiste: <strong>{selectedLabel}</strong></p>}
        </>}
      </div>
      <div className="form-step">
        <h2>2. Tus datos</h2>
        <div className="field-grid">
          <div className="field"><label htmlFor="name">Nombre</label><input id="name" name="name" required minLength={2} autoComplete="name" placeholder="Ej. Camila Rojas"/></div>
          <div className="field"><label htmlFor="company">Negocio</label><input id="company" name="company" required minLength={2} autoComplete="organization" defaultValue={defaultCompany} placeholder="Ej. Burger del Barrio"/></div>
          <div className="field"><label htmlFor="email">Email (te llega la invitación)</label><input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@negocio.cl"/></div>
          <div className="field"><label htmlFor="phone">WhatsApp</label><input id="phone" name="phone" type="tel" required minLength={8} autoComplete="tel" placeholder="+56 9 ..."/></div>
        </div>
        <div className="field full">
          <label htmlFor="topic">¿Qué te gustaría resolver? (opcional)</label>
          <textarea id="topic" name="topic" maxLength={500} defaultValue={defaultTopic} placeholder="Ej. En hora punta no alcanzamos a responder los pedidos por WhatsApp."/>
        </div>
        <div className="field"><label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 500 }}><input name="consentGiven" type="checkbox" required style={{ width: 17, marginTop: 2 }}/>Acepto que me contacten para coordinar y preparar esta reunión. Mis datos no se usarán para otros envíos.</label></div>
        <div className="form-trap" aria-hidden="true"><label htmlFor="website">Sitio web</label><input id="website" name="website" tabIndex={-1} autoComplete="off"/></div>
        {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onToken={setCaptchaToken} resetKey={captchaResetKey}/>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" type="submit" disabled={status === "sending" || !data}>
          {status === "sending" ? <LoaderCircle size={17}/> : "Agendar reunión"}
        </button></div>
      </div>
    </form>
  </div>;
}
