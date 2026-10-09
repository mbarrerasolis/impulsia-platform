import { BellRing, CalendarCheck, CircleCheckBig, MessageCircle, Sparkles, type LucideIcon } from "lucide-react";

const steps: { icon: LucideIcon; title: string; text: string; when: string }[] = [
  { icon: MessageCircle, title: "El paciente escribe", text: "Por WhatsApp, a la hora que sea.", when: "22:41" },
  { icon: Sparkles, title: "La asistente responde", text: "Entiende qué necesita y le ofrece sólo tus horas libres.", when: "al instante" },
  { icon: CalendarCheck, title: "Queda en tu agenda", text: "La cita se crea en tu AgendaPro o Google Calendar.", when: "22:42" },
  { icon: BellRing, title: "Recordatorio", text: "El día antes, con la dirección y lo que debe traer.", when: "24 h antes" },
  { icon: CircleCheckBig, title: "Confirma o reagenda", text: "Con un toque. Tu agenda se actualiza sola.", when: "1 toque" },
];

/** Diagrama del recorrido de una cita, de WhatsApp a la agenda. */
export function SaludFlow() {
  return <ol className="sl-flow">{steps.map(({ icon: Icon, title, text, when }, index) => <li key={title} style={{ animationDelay: `${index * 120}ms` }}>
    <span className="sl-flow-icon"><Icon size={30} strokeWidth={2.4} /></span>
    <span className="sl-flow-when">{when}</span>
    <h3>{title}</h3>
    <p>{text}</p>
  </li>)}</ol>;
}
