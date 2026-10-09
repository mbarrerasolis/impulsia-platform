import { BadgeCheck, CalendarCheck, CreditCard, ListChecks, MapPinned, Stethoscope, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Lo que resuelve la asistente, cada capacidad con una viñeta visual. Montos y servicios son ejemplos ilustrativos. */
const items: { icon: LucideIcon; title: string; text: string; visual: ReactNode }[] = [
  {
    icon: ListChecks,
    title: "Explica tus servicios",
    text: "Cuenta qué haces, cuánto dura cada atención, dónde atiendes y qué debe traer el paciente. Con tus palabras.",
    visual: <ul className="sl-mini-list">
      <li><b>Evaluación inicial</b><span>45 min</span></li>
      <li><b>Sesión de tratamiento</b><span>45 min</span></li>
      <li><b>Atención a domicilio</b><span>60 min</span></li>
    </ul>,
  },
  {
    icon: CreditCard,
    title: "Da tus tarifas",
    text: "Responde precios, packs y medios de pago al instante, sin que el paciente tenga que esperar tu respuesta.",
    visual: <ul className="sl-mini-list sl-mini-prices">
      <li><b>Evaluación</b><span>$30.000</span></li>
      <li><b>Sesión</b><span>$25.000</span></li>
      <li><b>Pack 10 sesiones</b><span>$220.000</span></li>
    </ul>,
  },
  {
    icon: CalendarCheck,
    title: "Agenda en tu calendario",
    text: "Ofrece sólo tus horas libres y deja la cita en tu AgendaPro o Google Calendar, con recordatorio el día antes.",
    visual: <div className="sl-mini-cal">
      {["9:00", "10:00", "11:00", "12:00"].map((hour, index) => <span key={hour} className={index === 2 ? "sl-mini-new" : index === 0 ? "sl-mini-busy" : ""}>{hour}{index === 2 && <em>Nueva</em>}</span>)}
    </div>,
  },
  {
    icon: BadgeCheck,
    title: "Cobra y valida el pago",
    text: "Envía el link de pago y confirma cuando entra. Si te transfieren, revisa el comprobante y te avisa para aprobarlo.",
    visual: <div className="sl-mini-pay">
      <span className="sl-mini-link">Link de pago · $30.000</span>
      <span className="sl-mini-ok"><BadgeCheck size={18} /> Pago confirmado</span>
    </div>,
  },
  {
    icon: MapPinned,
    title: "Toma direcciones y arma tu ruta",
    text: "Si atiendes a domicilio, pide la dirección al agendar y te deja ordenada la ruta del día.",
    visual: <ol className="sl-mini-route">
      <li><b>9:00</b><span>Ñuñoa · Av. Irarrázaval</span></li>
      <li><b>10:30</b><span>Providencia · Los Leones</span></li>
      <li><b>12:00</b><span>Las Condes · Apoquindo</span></li>
    </ol>,
  },
  {
    icon: Stethoscope,
    title: "Te deriva lo clínico",
    text: "No da diagnósticos ni indicaciones médicas: si el paciente pregunta algo clínico o urgente, te avisa a ti.",
    visual: <div className="sl-mini-handoff">
      <span>“¿Es normal que me duela más después de la sesión?”</span>
      <b>→ Te lo pasa a ti</b>
    </div>,
  },
];

export function SaludCapabilities() {
  return <div className="sl-caps">{items.map(({ icon: Icon, title, text, visual }) => <article className="sl-cap" key={title}>
    <div className="sl-cap-visual" aria-hidden="true">{visual}</div>
    <h3><span className="sl-cap-icon"><Icon size={22} strokeWidth={2.4} /></span>{title}</h3>
    <p>{text}</p>
  </article>)}</div>;
}
