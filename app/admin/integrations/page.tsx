import { CheckCircle2, CircleDashed, CircleDot } from "lucide-react";
import { integrationStatuses, type IntegrationState } from "@/domain/config/integration-status";
import { getBusinessProfile } from "@/lib/business";
import { getServerEnv } from "@/lib/env";
import { getStorefront } from "@/lib/storefront";

const stateLabels: Record<IntegrationState, string> = { ok: "Conectado", partial: "Parcial", off: "Pendiente" };
const stateClass: Record<IntegrationState, string> = { ok: "active", partial: "paused", off: "prospect" };
const StateIcon = ({ state }: { state: IntegrationState }) => state === "ok"
  ? <CheckCircle2 size={18} color="var(--teal)" aria-hidden />
  : state === "partial" ? <CircleDot size={18} color="#835e0c" aria-hidden /> : <CircleDashed size={18} color="var(--muted)" aria-hidden />;

/** Qué está conectado en esta edición y qué falta (sólo nombres de variables, nunca valores). */
export default function IntegrationsPage() {
  const { modules } = getBusinessProfile();
  const assistant = getStorefront()?.assistant;
  const list = integrationStatuses({
    env: getServerEnv() as unknown as Record<string, string | number | undefined>,
    modules,
    ...(modules.store ? { assistant: { name: assistant?.name, hasStyle: Boolean(assistant?.style.length) } } : {}),
  });
  const pending = list.filter((item) => item.state !== "ok").length;

  return <>
    <div className="admin-title">
      <div>
        <h1>Integraciones</h1>
        <p className="muted">Servicios conectados a esta edición. Las claves se cargan en Vercel; aquí sólo se ve si existen.</p>
      </div>
      <span className={`state ${pending ? "paused" : "active"}`}>{pending ? `${pending} por completar` : "Todo conectado"}</span>
    </div>
    <section className="card panel">
      <ul className="integration-list">
        {list.map((item) => <li key={item.key}>
          <StateIcon state={item.state} />
          <div>
            <h2>{item.name} <span className={`state ${stateClass[item.state]}`}>{stateLabels[item.state]}</span></h2>
            <p className="muted">{item.purpose}</p>
            <p>{item.detail}</p>
            {item.missing.length > 0 && <p className="integration-missing">Falta: {item.missing.map((name) => <code key={name}>{name}</code>)}</p>}
          </div>
        </li>)}
      </ul>
    </section>
  </>;
}
