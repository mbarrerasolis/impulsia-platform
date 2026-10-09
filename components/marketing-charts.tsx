import type { FunnelStep, SeriesPoint } from "@/domain/marketing/performance";

const integer = new Intl.NumberFormat("es-CL");
export const formatPercent = (value?: number) => value === undefined ? "—" : `${(value * 100).toLocaleString("es-CL", { maximumFractionDigits: value < 0.1 ? 1 : 0 })}%`;

/** Embudo horizontal: una barra por paso, escala lineal sobre el primer paso, con conversión entre pasos. */
export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((step) => step.value));
  return (
    <ol className="funnel" aria-label="Embudo de conversión">
      {steps.map((step) => (
        <li key={step.key} className="funnel-step">
          <div className="funnel-head">
            <span>{step.label}</span>
            <strong>{integer.format(step.value)}</strong>
          </div>
          <div className="funnel-track" aria-hidden>
            <span className="funnel-bar" style={{ width: `${step.value > 0 ? Math.max(1.5, (step.value / max) * 100) : 0}%` }} />
          </div>
          {step.rateFromPrevious !== undefined && <span className="funnel-rate">{formatPercent(step.rateFromPrevious)} del paso anterior</span>}
        </li>
      ))}
    </ol>
  );
}

type Metric = "visits" | "leads" | "spend";

/**
 * Columnas de una sola serie por tramo (día o semana). Cada columna trae su tooltip nativo y
 * el valor máximo queda rotulado; el detalle exacto está en las tablas.
 */
export function TrendChart({ title, points, metric, format, granularity }: { title: string; points: SeriesPoint[]; metric: Metric; format: (value: number) => string; granularity: "day" | "week" }) {
  const width = 320, height = 140, top = 18, bottom = 20, left = 2, right = 2;
  const values = points.map((point) => point[metric]);
  const max = Math.max(0, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const slot = (width - left - right) / Math.max(1, points.length);
  const bar = Math.max(1, Math.min(18, slot - 2));
  const plot = height - top - bottom;
  const labelEvery = Math.ceil(points.length / 6);
  const peak = values.indexOf(max);
  const period = granularity === "day" ? "día" : "semana";
  // La etiqueta del máximo se alinea hacia adentro cerca de los bordes para no salirse del gráfico.
  const peakAnchor = peak < points.length * 0.2 ? "start" : peak > points.length * 0.8 ? "end" : "middle";

  return (
    <figure className="trend-chart">
      <figcaption><span>{title}</span><strong>{format(total)}</strong></figcaption>
      {max === 0 ? <p className="muted trend-empty">Sin datos en el período.</p> : (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} por ${period}: total ${format(total)}, máximo ${format(max)}`}>
          <line x1={left} x2={width - right} y1={top + plot} y2={top + plot} className="trend-axis" />
          {points.map((point, index) => {
            const value = point[metric];
            const h = value > 0 ? Math.max(2, (value / max) * plot) : 0;
            const x = left + index * slot + (slot - bar) / 2;
            return (
              <g key={point.start} className="trend-col">
                <rect x={left + index * slot} y={top} width={slot} height={plot} className="trend-hit"><title>{`${granularity === "week" ? "Semana del " : ""}${point.label}: ${format(value)}`}</title></rect>
                {h > 0 && <path d={roundedTop(x, top + plot - h, bar, h)} className="trend-bar" />}
                {index % labelEvery === 0 && <text x={left + index * slot + slot / 2} y={height - 6} textAnchor="middle" className="trend-label">{point.label}</text>}
                {index === peak && <text x={peakAnchor === "end" ? x + bar : peakAnchor === "start" ? x : x + bar / 2} y={top + plot - h - 5} textAnchor={peakAnchor} className="trend-value">{format(value)}</text>}
              </g>
            );
          })}
        </svg>
      )}
    </figure>
  );
}

/** Columna con las esquinas superiores redondeadas (4 px) y la base recta sobre el eje. */
function roundedTop(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
