import type { LandingContent } from "@/domain/config/edition";
import { Illustration } from "./illustrations";

type SalesCycle = NonNullable<LandingContent["salesCycle"]>;

const INK = "#0B2526";
const PAPER = "#F2F7F1";
const LIME = "#B8F74F";

// Seis nodos sobre una elipse (centro 500,350; radios 390 × 235), en sentido horario desde arriba a la izquierda.
const NODES = [
  { x: 162, y: 232 }, { x: 500, y: 115 }, { x: 838, y: 232 },
  { x: 838, y: 468 }, { x: 500, y: 585 }, { x: 162, y: 468 },
];
const ARC = "A390 235 0 0 1";
const LOOP = `M162 232${NODES.slice(1).map((n) => `${ARC} ${n.x} ${n.y}`).join("")}${ARC} 162 232Z`;

/** Ciclo de venta: diagrama en escritorio, lista numerada en teléfonos. */
export function SalesCycleFigure({ cycle }: { cycle: SalesCycle }) {
  const label = cycle.steps.map((step, index) => `${index + 1}. ${step.label}, ${step.detail}`).join("; ");
  return <figure className="lp-figure">
    <div className="lp-sheet lp-cycle-wide">
      <svg viewBox="0 0 1000 720" role="img" aria-label={`Ciclo de venta en seis pasos: ${label}. Luego vuelve al primero.`}>
        <path d={LOOP} fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <path id="lp-loop" d={LOOP} fill="none" />
        <circle className="lp-cycle-dot" r="13" fill={LIME} stroke={INK} strokeWidth="3">
          <animateMotion dur="16s" repeatCount="indefinite"><mpath href="#lp-loop" /></animateMotion>
        </circle>

        {cycle.centerLines.map((line, index) => {
          const top = 362 - (cycle.centerLines.length - 1) * 23;
          return <text key={line} x="500" y={top + index * 46} textAnchor="middle" className="lp-svg-display" fontSize="42">{line}</text>;
        })}

        {cycle.steps.map((step, index) => {
          const { x, y } = NODES[index];
          return <g key={step.label}>
            <circle cx={x} cy={y} r="62" fill={index === 1 ? LIME : PAPER} stroke={INK} strokeWidth="4" />
            <use href={`#lp-i-${step.icon}`} x={x - 35} y={y - 35} width="70" height="70" />
            <circle cx={x + 46} cy={y - 46} r="17" fill={INK} />
            <text x={x + 46} y={y - 40} textAnchor="middle" fontSize="18" fontWeight="800" fill={PAPER}>{index + 1}</text>
            <text x={x} y={y + 92} textAnchor="middle" className="lp-svg-display" fontSize="25">{step.label}</text>
            <text x={x} y={y + 117} textAnchor="middle" fontSize="17" className="lp-svg-muted">{step.detail}</text>
          </g>;
        })}
      </svg>
    </div>

    <ol className="lp-cycle-list">
      {cycle.steps.map((step) => <li key={step.label}>
        <Illustration name={step.icon} size={52} />
        <div><strong>{step.label}</strong><p>{step.text}</p></div>
      </li>)}
    </ol>
    <figcaption>{cycle.caption}</figcaption>
  </figure>;
}
