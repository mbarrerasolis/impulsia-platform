"use client";

import { useId, useState } from "react";

const WEEKS_PER_MONTH = 52 / 12;
const WORKDAY_HOURS = 8;

function Slider({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="sl-slider">
    <label htmlFor={id}><span>{label}</span><output htmlFor={id}>{value}{unit ? ` ${unit}` : ""}</output></label>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))}
      style={{ "--sl-fill": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties} />
  </div>;
}

/** Calculadora: cuántas horas al mes se van en contestar WhatsApp, en jornadas completas de 8 horas. */
export function SaludTimeCalculator() {
  const [messages, setMessages] = useState(20);
  const [minutes, setMinutes] = useState(3);
  const [days, setDays] = useState(5);
  const hours = (messages * minutes * days * WEEKS_PER_MONTH) / 60;
  const workdays = hours / WORKDAY_HOURS;
  const blocks = Math.max(1, Math.ceil(workdays));
  const format = (value: number) => value.toLocaleString("es-CL", { maximumFractionDigits: 1 });
  return <div className="sl-calc lp-sheet">
    <div className="sl-calc-inputs">
      <h3>Haz la cuenta con tus números</h3>
      <Slider label="Mensajes de pacientes al día" value={messages} min={5} max={80} onChange={setMessages} />
      <Slider label="Minutos por conversación" value={minutes} min={1} max={10} onChange={setMinutes} unit="min" />
      <Slider label="Días de atención a la semana" value={days} min={3} max={6} onChange={setDays} unit="días" />
      <p className="sl-note">Cuenta el ir y venir: leer, revisar la agenda, ofrecer horas, confirmar.</p>
    </div>
    <div className="sl-calc-result" aria-live="polite">
      <span className="sl-calc-label">Al mes contestas WhatsApp</span>
      <strong className="sl-calc-hours">{format(hours)} h</strong>
      <span className="sl-calc-label">equivale a <b>{format(workdays)} jornadas completas</b> de {WORKDAY_HOURS} horas</span>
      <div className="sl-calc-days" role="img" aria-label={`${format(workdays)} jornadas de ${WORKDAY_HOURS} horas`}>
        {Array.from({ length: blocks }, (_, index) => {
          const fill = Math.min(1, Math.max(0, workdays - index));
          return <span key={index} title={`Jornada ${index + 1}: ${format(fill * WORKDAY_HOURS)} h`}><i style={{ height: `${fill * 100}%` }} /></span>;
        })}
      </div>
      <p className="sl-calc-foot">Con una asistente, ese tiempo vuelve a tus pacientes (o a tu casa).</p>
    </div>
  </div>;
}
