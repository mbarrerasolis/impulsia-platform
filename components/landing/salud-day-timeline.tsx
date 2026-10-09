"use client";

import { useState } from "react";

/** Un día ilustrativo de una consulta independiente: atenciones, mensajes de pacientes y cuánto esperan por respuesta. */
const START = 8 * 60;
const END = 22 * 60;
const X0 = 170;
const X1 = 1080;
const LANES = { agenda: 62, without: 148, with: 226 };
const x = (minute: number) => X0 + ((Math.min(minute, END) - START) / (END - START)) * (X1 - X0);
const hhmm = (minute: number) => `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, "0")}`;

const sessions = [540, 600, 660, 720, 900, 960, 1020, 1080];
const SESSION_LENGTH = 45;
/** reply: cuándo alcanzas a contestar sin asistente; null = al día siguiente. */
const messages: { at: number; reply: number | null; text: string }[] = [
  { at: 560, reply: 585, text: "Pide hora para esta semana" },
  { at: 635, reply: 645, text: "Pregunta el precio de la sesión" },
  { at: 670, reply: 705, text: "Quiere cambiar su hora del viernes" },
  { at: 745, reply: 765, text: "Pregunta si atiendes con Fonasa" },
  { at: 940, reply: 945, text: "Pide la dirección de la consulta" },
  { at: 975, reply: 1005, text: "Pide hora para su hijo" },
  { at: 1070, reply: 1125, text: "Avisa que no podrá ir mañana" },
  { at: 1290, reply: null, text: "Pide hora (escribe de noche)" },
];

const answered = messages.filter((item) => item.reply !== null);
const averageWait = Math.round(answered.reduce((sum, item) => sum + (item.reply! - item.at), 0) / answered.length);
const longestWait = Math.max(...answered.map((item) => item.reply! - item.at));

const TEAL = "#0A8F80";
const CORAL = "#E8613A";

export function SaludDayTimeline() {
  const [active, setActive] = useState<number | null>(null);
  const current = active === null ? null : messages[active];
  return <figure className="sl-day">
    <div className="sl-day-legend" aria-hidden="true">
      <span><i className="sl-key-block" /> Atendiendo pacientes</span>
      <span><i className="sl-key-line" style={{ background: CORAL }} /> Paciente esperando respuesta</span>
      <span><i className="sl-key-dot" style={{ background: TEAL }} /> Respondido al instante</span>
    </div>
    <div className="sl-day-scroll">
      <div className="sl-day-canvas">
        <svg viewBox="0 0 1100 290" role="img" aria-label={`Un día de consulta: sin asistente cada paciente espera en promedio ${averageWait} minutos y quien escribe de noche espera hasta el día siguiente; con asistente todos reciben respuesta al instante.`}>
          {Array.from({ length: (END - START) / 60 + 1 }, (_, index) => START + index * 60).map((minute) => <g key={minute}>
            <line x1={x(minute)} x2={x(minute)} y1={30} y2={250} stroke="#DCE7E1" strokeWidth={1} />
            {(minute / 60) % 2 === 0 && <text x={x(minute)} y={276} textAnchor="middle" className="sl-day-tick">{hhmm(minute)}</text>}
          </g>)}
          <text x={0} y={LANES.agenda + 6} className="sl-day-lane">Tu agenda</text>
          <text x={0} y={LANES.without + 6} className="sl-day-lane">Sin asistente</text>
          <text x={0} y={LANES.with + 6} className="sl-day-lane">Con asistente</text>
          {sessions.map((minute) => <rect key={minute} x={x(minute) + 1} y={LANES.agenda - 16} width={x(minute + SESSION_LENGTH) - x(minute) - 2} height={32} rx={4} fill="#C9DBD2" />)}
          {messages.map((item, index) => {
            const end = item.reply ?? END;
            const dim = active !== null && active !== index;
            return <g key={item.at} opacity={dim ? .3 : 1}>
              <line x1={x(item.at)} x2={x(end)} y1={LANES.without} y2={LANES.without} stroke={CORAL} strokeWidth={6} strokeLinecap="round" />
              <circle cx={x(item.at)} cy={LANES.without} r={7} fill={CORAL} stroke="#fff" strokeWidth={2} />
              {item.reply === null
                ? <path d={`M${x(END) - 2} ${LANES.without - 9} l12 9 -12 9`} fill="none" stroke={CORAL} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                : <circle cx={x(end)} cy={LANES.without} r={5} fill="#fff" stroke={CORAL} strokeWidth={3} />}
              <circle cx={x(item.at)} cy={LANES.with} r={8} fill={TEAL} stroke="#fff" strokeWidth={2} />
              <rect x={x(item.at) - 16} y={LANES.without - 24} width={Math.max(32, x(end) - x(item.at) + 32)} height={LANES.with - LANES.without + 48} fill="transparent"
                tabIndex={0} role="button" aria-label={`${hhmm(item.at)}: ${item.text}`}
                onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} />
            </g>;
          })}
          <text x={X1 + 8} y={LANES.without - 18} textAnchor="end" className="sl-day-callout">espera hasta mañana</text>
          <text x={x(1070) + 4} y={LANES.without - 18} className="sl-day-callout">{longestWait} min</text>
        </svg>
        {current && <div className="sl-tip" style={{ left: `${(x(current.at) / 1100) * 100}%` }} role="status">
          <b>{hhmm(current.at)} · {current.text}</b>
          <span><i style={{ background: CORAL }} /> Sin asistente: {current.reply === null ? "le respondes mañana" : `le respondes a las ${hhmm(current.reply)} (${current.reply - current.at} min)`}</span>
          <span><i style={{ background: TEAL }} /> Con asistente: al instante</span>
        </div>}
      </div>
    </div>
    <div className="sl-day-stats">
      <div><strong>{averageWait} min</strong><span>espera promedio sin asistente, en un día con tu agenda llena</span></div>
      <div><strong>Hasta mañana</strong><span>espera quien te escribe de noche, cuando más se agenda</span></div>
      <div className="sl-day-stat-good"><strong>Segundos</strong><span>con asistente, a cualquier hora y sin interrumpir tus atenciones</span></div>
    </div>
    <figcaption className="sl-note">Día ilustrativo de una consulta independiente. Pasa el cursor o toca cada mensaje para ver el detalle.</figcaption>
    <div className="sl-sr"><table>
      <caption>Mensajes del día y tiempo de respuesta</caption>
      <thead><tr><th>Hora</th><th>Mensaje</th><th>Sin asistente</th><th>Con asistente</th></tr></thead>
      <tbody>{messages.map((item) => <tr key={item.at}><td>{hhmm(item.at)}</td><td>{item.text}</td><td>{item.reply === null ? "al día siguiente" : `${item.reply - item.at} min`}</td><td>al instante</td></tr>)}</tbody>
    </table></div>
  </figure>;
}
