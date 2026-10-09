import type { Route } from "next";
import Link from "next/link";
import { ClipboardList, PackageCheck, Plus, Wallet } from "lucide-react";
import { currentQuote, saleStageLabels, saleStages, saleStatusLabels, type Sale, type SaleStage } from "@/domain/storefront/sales";
import { internalRoles, requireRole } from "@/lib/auth/authorization";
import { getSaleRepository } from "@/repositories";
import { editionMoney } from "@/services/store/sales-runtime";
import { formatSaleDateTime, saleStatusClass } from "./format";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
const stageKeys = Object.keys(saleStages) as SaleStage[];

function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Wallet }) {
  return <article className="card stat"><div className="stat-top"><span>{label}</span><Icon size={17} aria-hidden /></div><div className="stat-value">{value}</div><div className="stat-change">{detail}</div></article>;
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  await requireRole(internalRoles);
  const money = editionMoney();
  const requested = first(params.etapa);
  const stage: SaleStage | "todas" = requested && requested in saleStages ? requested as SaleStage : "todas";
  const query = (first(params.q) ?? "").trim();
  const repository = getSaleRepository();
  const [sales, open] = await Promise.all([
    repository.list({ ...(stage !== "todas" ? { statuses: saleStages[stage] } : {}), query, limit: 200 }),
    repository.list({ statuses: [...saleStages.cotizaciones, ...saleStages.pagos, ...saleStages.despacho], limit: 500 }),
  ]);
  const inStage = (key: SaleStage) => open.filter((sale) => (saleStages[key] as readonly string[]).includes(sale.status));
  const sum = (list: Sale[]) => money(list.reduce((total, sale) => total + (currentQuote(sale)?.totals.total ?? 0), 0));
  const href = (next: SaleStage | "todas") => `/admin/sales?etapa=${next}${query ? `&q=${encodeURIComponent(query)}` : ""}` as Route;

  return <>
    <div className="admin-title">
      <div>
        <h1>Ventas</h1>
        <p className="muted">Cotizaciones con versiones, pagos por revisar y pedidos por despachar. Las arma el equipo o la vendedora virtual.</p>
      </div>
      <Link className="btn btn-primary btn-sm" href={"/admin/sales/new" as Route}><Plus size={15} /> Nueva cotización</Link>
    </div>

    <section className="stat-grid" aria-label="Resumen de ventas">
      <Stat label="Cotizaciones abiertas" icon={ClipboardList} value={String(inStage("cotizaciones").length)} detail={sum(inStage("cotizaciones"))} />
      <Stat label="Pagos por revisar" icon={Wallet} value={String(open.filter((sale) => sale.status === "payment_in_review").length)} detail={`${inStage("pagos").length} con pago pendiente o en revisión`} />
      <Stat label="Por despachar" icon={PackageCheck} value={String(inStage("despacho").length)} detail={sum(inStage("despacho"))} />
    </section>

    <form className="card panel filter-bar" method="get" action="/admin/sales" aria-label="Buscar ventas" style={{ marginTop: 16 }}>
      <nav className="segmented" aria-label="Filtrar por etapa">
        <Link href={href("todas")} className={stage === "todas" ? "selected" : ""}>Todas</Link>
        {stageKeys.map((key) => <Link key={key} href={href(key)} className={stage === key ? "selected" : ""}>{saleStageLabels[key]}</Link>)}
      </nav>
      <input type="hidden" name="etapa" value={stage} />
      <label className="filter-search"><span>Buscar</span><input name="q" defaultValue={query} placeholder="N° de cotización o pedido, cliente, teléfono" /></label>
      <div className="filter-actions"><button className="btn btn-primary btn-sm" type="submit">Buscar</button></div>
    </form>

    <section className="card panel">
      {sales.length === 0
        ? <p className="muted">No hay ventas{stage !== "todas" ? ` en "${saleStageLabels[stage]}"` : ""}. Las cotizaciones que prepare la vendedora virtual o el equipo aparecen aquí.</p>
        : <div className="table-wrap">
          <table className="data-table compact">
            <thead><tr><th>N°</th><th>Cliente</th><th>Estado</th><th className="num">Total</th><th>Actualizada</th></tr></thead>
            <tbody>{sales.map((sale) => {
              const quote = currentQuote(sale);
              return <tr key={sale.id}>
                <td><Link href={`/admin/sales/${sale.id}` as Route}><strong>{sale.orderNumber ?? sale.number}</strong></Link><span className="muted lead-sub">{sale.orderNumber ? `${sale.number} ` : ""}V{sale.currentVersion}</span></td>
                <td>{sale.customer.name}{sale.customer.kind === "negocio" && sale.customer.company && <span className="muted lead-sub">{sale.customer.company}</span>}</td>
                <td><span className={`state ${saleStatusClass[sale.status]}`}>{saleStatusLabels[sale.status]}</span></td>
                <td className="num">{quote ? money(quote.totals.total) : "—"}{quote && quote.totals.shipping === undefined && <span className="muted lead-sub">sin transporte</span>}</td>
                <td>{formatSaleDateTime(sale.updatedAt)}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
    </section>
  </>;
}
