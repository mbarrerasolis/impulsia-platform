import type { Route } from "next";
import Link from "next/link";
import { LeadOriginTag } from "@/components/lead-origin-tag";
import { Pagination } from "@/components/pagination";
import { leadSources } from "@/domain/crm/entities";
import { hasLeadFilters, leadOrigins, leadStatuses, parseLeadFilters, type LeadFilters } from "@/domain/crm/lead-filters";
import { leadTemperature, temperatureLabels, type LeadTemperatureView } from "@/domain/crm/lead-temperature";
import { attributionLabel } from "@/domain/marketing/attribution";
import { formatDate } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { getLeadRepository } from "@/repositories";
import type { LeadListSort } from "@/repositories/lead-repository";

const statusLabels = { new: "Nuevo", contacted: "Contactado", qualified: "Calificado", converted: "Convertido", lost: "Perdido" };
const sourceLabels = { web: "Web", instagram: "Instagram", whatsapp: "WhatsApp", email: "Email", referral: "Referido", outbound: "Prospección", other: "Otro" };
const temperatureViews: LeadTemperatureView[] = ["hot", "warm", "cold", "closed"];
/** Más filas por página para ver el panorama completo del pipeline. */
const crmPageSize = 50;

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

/** Parámetros de la URL que conservan los filtros activos al cambiar de vista o de página. */
function filterParams(filters: LeadFilters): Record<string, string> {
  return {
    ...(filters.search ? { q: filters.search } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.origin ? { origin: filters.origin } : {}),
  };
}

function crmHref(filters: { temp?: LeadTemperatureView; sort: LeadListSort; filters: LeadFilters }) {
  const params = new URLSearchParams(filterParams(filters.filters));
  if (filters.temp) params.set("temp", filters.temp);
  if (filters.sort !== "priority") params.set("sort", filters.sort);
  const query = params.toString();
  return `/admin/crm${query ? `?${query}` : ""}` as Route;
}

export default async function CrmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const tempParam = first(params.temp);
  const temp = temperatureViews.find((view) => view === tempParam);
  const sort: LeadListSort = first(params.sort) === "recent" ? "recent" : "priority";
  const filters = parseLeadFilters(params);
  const filtered = hasLeadFilters(filters);
  const repository = getLeadRepository();
  const [result, counts] = await Promise.all([
    repository.listPage({ page, pageSize: crmPageSize, temperature: temp, sort, ...filters }),
    repository.countByTemperature(filters),
  ]);
  const totalAll = temperatureViews.reduce((sum, view) => sum + counts[view], 0);
  const keep = { ...filterParams(filters), ...(temp ? { temp } : {}), ...(sort !== "priority" ? { sort } : {}) };

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>CRM</h1>
          <p className="muted">Leads por temperatura: primero los que están listos para avanzar.</p>
        </div>
        <Link href="/diagnostico" className="btn btn-primary">Nuevo lead</Link>
      </div>

      <form className="card panel filter-bar" method="get" action="/admin/crm" role="search" aria-label="Filtrar leads">
        {temp && <input type="hidden" name="temp" value={temp}/>}
        {sort !== "priority" && <input type="hidden" name="sort" value={sort}/>}
        <label className="filter-search"><span>Buscar</span><input type="search" name="q" defaultValue={filters.search} placeholder="Nombre, empresa, email o teléfono"/></label>
        <label><span>Canal</span><select name="source" defaultValue={filters.source ?? ""}><option value="">Todos</option>{leadSources.map((value) => <option key={value} value={value}>{sourceLabels[value]}</option>)}</select></label>
        <label><span>Origen</span><select name="origin" defaultValue={filters.origin ?? ""}><option value="">Todos</option>{Object.entries(leadOrigins).map(([key, origin]) => <option key={key} value={key}>{origin.label}</option>)}</select></label>
        <label><span>Etapa</span><select name="status" defaultValue={filters.status ?? ""}><option value="">Todas</option>{leadStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
        <div className="filter-actions"><button className="btn btn-primary btn-sm" type="submit">Filtrar</button>{filtered && <Link className="btn btn-secondary btn-sm" href={crmHref({ temp, sort, filters: {} })}>Limpiar</Link>}</div>
      </form>

      <nav className="temp-summary" aria-label="Filtrar por temperatura">
        <Link href={crmHref({ sort, filters })} className={`temp-card temp-all${!temp ? " selected" : ""}`}>
          <span className="temp-card-label">Todos</span>
          <strong>{totalAll}</strong>
        </Link>
        {temperatureViews.map((view) => (
          <Link key={view} href={crmHref({ temp: view, sort, filters })} className={`temp-card temp-${view}${temp === view ? " selected" : ""}`}>
            <span className="temp-card-label"><span className="temp-dot" aria-hidden />{temperatureLabels[view]}s</span>
            <strong>{counts[view]}</strong>
          </Link>
        ))}
      </nav>

      <div className="card panel">
        <div className="panel-head">
          <h2>{temp ? `Leads ${temperatureLabels[temp].toLowerCase()}s` : "Pipeline"}{filtered && <span className="muted"> · {result.total} con filtros</span>}</h2>
          <div className="segmented" role="group" aria-label="Orden">
            <Link href={crmHref({ temp, sort: "priority", filters })} className={sort === "priority" ? "selected" : ""}>Más calientes</Link>
            <Link href={crmHref({ temp, sort: "recent", filters })} className={sort === "recent" ? "selected" : ""}>Más recientes</Link>
          </div>
        </div>
        {result.items.length === 0 ? (
          <p className="muted">{filtered ? "Ningún lead coincide con los filtros." : "No hay leads en esta vista."}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table compact lead-table">
              <thead>
                <tr><th>Temperatura</th><th>Contacto</th><th>Qué busca</th><th>Procedencia</th><th>Etapa</th><th>Ingreso</th><th /></tr>
              </thead>
              <tbody>
                {result.items.map((lead) => {
                  const view = leadTemperature(lead);
                  return (
                    <tr key={lead.id} className={`temp-row temp-${view}`}>
                      <td><span className={`temp-pill temp-${view}`}><span className="temp-dot" aria-hidden />{temperatureLabels[view]}</span></td>
                      <td>
                        <Link href={`/admin/crm/${lead.id}`} className="lead-name">{lead.name}</Link>
                        <span className="muted lead-sub">{lead.company}{lead.phone ? ` · ${lead.phone}` : ` · ${lead.email}`}</span>
                      </td>
                      <td className="lead-goal" title={lead.primaryGoal}>{lead.primaryGoal}</td>
                      <td><LeadOriginTag lead={lead} /><span className="muted lead-sub">{sourceLabels[lead.source]}{lead.attribution ? ` · ${attributionLabel(lead.attribution)}` : ""}</span></td>
                      <td><span className={`state ${lead.status === "converted" ? "active" : lead.status === "lost" ? "paused" : "prospect"}`}>{statusLabels[lead.status]}</span></td>
                      <td className="muted">{formatDate(lead.createdAt)}</td>
                      <td><Link href={`/admin/crm/${lead.id}`} className="btn btn-secondary btn-sm">Abrir</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination path="/admin/crm" page={result.page} totalPages={result.totalPages} total={result.total} params={keep} />
      </div>
    </>
  );
}
