import { CalendarCheck, Check, Zap } from "lucide-react";

/** Teléfono del hero de /salud: un paciente pide hora por WhatsApp y la asistente la deja agendada. Ejemplo ilustrativo. */
export function SaludHeroPhone() {
  return <figure className="sl-hero-visual" aria-label="Ejemplo: una paciente pide hora por WhatsApp y la asistente la agenda en tu calendario">
    <div className="sl-phone">
      <div className="sl-phone-top">
        <span className="sl-phone-avatar"><Zap size={22} fill="currentColor" strokeWidth={0} /></span>
        <div><b>Kinesiología · Asistente</b><small>en línea</small></div>
      </div>
      <div className="sl-chat">
        <p className="sl-bubble sl-in">Hola! ¿Tienes hora esta semana? Me duele la rodilla 🙏<time>22:41</time></p>
        <div className="sl-bubble sl-out">¡Hola Camila! Claro 😊 Tengo estas horas:
          <span className="sl-slots"><span>Jue 10:00</span><span className="sl-on">Jue 17:30</span><span>Vie 9:00</span></span>
          <time>22:41</time>
        </div>
        <p className="sl-bubble sl-in">Jueves 17:30 porfa<time>22:42</time></p>
        <p className="sl-bubble sl-out">Listo ✅ Quedaste agendada el <b>jueves a las 17:30</b>. El día antes te mando un recordatorio.<time>22:42</time></p>
      </div>
    </div>
    <div className="sl-event">
      <span className="sl-event-ok"><Check size={22} strokeWidth={3.5} /></span>
      <span className="sl-event-head"><CalendarCheck size={20} /> Nueva cita agendada</span>
      <strong>Jue 9 · 17:30</strong>
      <span className="sl-event-who">Camila R. · Evaluación</span>
      <span className="sl-event-tags"><span>AgendaPro</span><span>Google Calendar</span></span>
    </div>
    <figcaption className="sl-note">Ejemplo ilustrativo</figcaption>
  </figure>;
}
