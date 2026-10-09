import type { Route } from "next";
import Link from "next/link";
import { Bot, Eye, Megaphone, MousePointerClick, Target, UserPlus, UsersRound, Wallet } from "lucide-react";
import { FunnelChart, TrendChart, formatPercent } from "@/components/marketing-charts";
import { DeleteExpenseButton, ExpenseForm, MetaSyncButton } from "@/components/marketing-expenses";
import { expenseCategories } from "@/domain/marketing/expenses";
import { leadChannels } from "@/domain/marketing/lead-channel";
import { reportPresets, type PerformanceRow } from "@/domain/marketing/performance";
import { formatDate, formatMoney } from "@/lib/format";
import { getServerEnv } from "@/lib/env";
import { isMetaAdsSyncConfigured } from "@/lib/marketing/meta-ads-sync";
import { getMarketingReport, localToday } from "@/services/marketing/marketing-report";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);
const integer = new Intl.NumberFormat("es-CL");
const count = (value: number) => value > 0 ? integer.format(value) : "—";
const categoryLabel = (key: string) => key === "ai_assistant" ? "IA · Claudia (automático)" : expenseCategories[key as keyof typeof expenseCategories];
const day = (date: string) => formatDate(`${date}T12:00:00`);

function PerformanceTable({ rows, money, empty, firstColumn, ads }: { rows: PerformanceRow[]; money: (value?: number) => string; empty: string; firstColumn: string; ads: boolean }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table className="data-table compact numeric-table">
        <thead>
          <tr>
            <th>{firstColumn}</th>
            {ads && <><th>Visualiz.</th><th>Clics</th><th>CTR</th><th>CPC</th></>}
            <th>Visitas</th><th>Leads</th><th>Visita → lead</th><th>Calientes</th><th>Clientes</th><th>Lead → cliente</th><th>Gasto</th><th>Costo por lead</th><th>CAC</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td><strong>{row.label}</strong>{row.paidLeads > 0 && <span className="muted lead-sub">{row.paidLeads} de anuncios</span>}</td>
              {ads && <><td>{count(row.impressions)}</td><td>{count(row.clicks)}</td><td>{formatPercent(row.ctr)}</td><td>{money(row.cpc)}</td></>}
              <td>{count(row.visits)}</td>
              <td>{row.leads}</td>
              <td>{formatPercent(row.visitToLeadRate)}</td>
              <td>{row.hot}</td>
              <td>{row.converted}</td>
              <td>{formatPercent(row.conversionRate)}</td>
              <td>{row.spend > 0 ? money(row.spend) : "—"}</td>
              <td>{money(row.costPerLead)}</td>
              <td>{money(row.cac)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Wallet }) {
  return <article className="card stat"><div className="stat-top"><span>{label}</span><Icon size={17} aria-hidden /></div><div className="stat-value">{value}</div><div className="stat-change">{detail}</div></article>;
}

export default async function MarketingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { range, currency, usdRate, expenses, occurrences, report } = await getMarketingReport({ preset: first(params.preset), from: first(params.from), to: first(params.to) });
  const money = (value?: number) => value === undefined ? "—" : formatMoney(value, currency);
  const today = localToday(getServerEnv().ASSISTANT_TIME_ZONE);
  const campaigns = report.byCampaign.map((row) => row.key);
  const chargesInRange = new Map<string, number>();
  for (const occurrence of occurrences) chargesInRange.set(occurrence.expense.id, (chargesInRange.get(occurrence.expense.id) ?? 0) + occurrence.amount);
  const { totals, series } = report;
  const hasAds = totals.impressions > 0 || totals.clicks > 0;
  const period = series.granularity === "day" ? "día" : "semana";

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Campañas y gastos</h1>
          <p className="muted">Conversión, costo por lead, CAC y gasto por procedencia y campaña: publicidad, Claudia (IA) y otros gastos.</p>
        </div>
      </div>

      <form className="card panel filter-bar" method="get" action="/admin/marketing" aria-label="Período del reporte">
        <nav className="segmented" aria-label="Períodos rápidos">
          {Object.entries(reportPresets).map(([key, label]) => (
            <Link key={key} href={`/admin/marketing?preset=${key}` as Route} className={range.preset === key ? "selected" : ""}>{label}</Link>
          ))}
        </nav>
        <label><span>Desde</span><input type="date" name="from" defaultValue={range.from} max={today} /></label>
        <label><span>Hasta</span><input type="date" name="to" defaultValue={range.to} /></label>
        <div className="filter-actions"><button className="btn btn-primary btn-sm" type="submit">Ver período</button></div>
      </form>

      <section className="stat-grid" aria-label="Resumen del período">
        <Stat label="Gasto total" icon={Wallet} value={money(totals.spend)} detail={`${day(range.from)} – ${day(range.to)}`} />
        <Stat label="Leads" icon={UsersRound} value={integer.format(totals.leads)} detail={`${totals.paidLeads} de anuncios · ${totals.hot} calientes`} />
        <Stat label="Costo por lead" icon={Target} value={money(totals.costPerLead)} detail={`${formatPercent(totals.conversionRate)} de los leads se convierte`} />
        <Stat label="CAC" icon={UserPlus} value={money(totals.cac)} detail={`${totals.converted} clientes nuevos en el período`} />
      </section>
      <section className="stat-grid" aria-label="Visualizaciones y tráfico" style={{ marginTop: 14 }}>
        <Stat label="Visitas al sitio" icon={Eye} value={integer.format(totals.visits)} detail={`${formatPercent(totals.visitToLeadRate)} deja sus datos (visita → lead)`} />
        <Stat label="Visualizaciones" icon={Megaphone} value={hasAds ? integer.format(totals.impressions) : "—"} detail={hasAds ? `CTR ${formatPercent(totals.ctr)} · CPM ${money(totals.cpm)}` : "Regístralas al cargar el gasto de un anuncio"} />
        <Stat label="Clics en anuncios" icon={MousePointerClick} value={hasAds ? integer.format(totals.clicks) : "—"} detail={hasAds ? `CPC ${money(totals.cpc)} · publicidad ${money(totals.adSpend)}` : "Desde el administrador de anuncios"} />
        <Stat label="Claudia (IA)" icon={Bot} value={money(report.ai.spend)} detail={`US$${report.ai.costUsd.toFixed(2)} · ${report.ai.replies} respuestas · ${report.ai.conversations} conversaciones${report.ai.costPerConversation !== undefined ? ` · ${money(report.ai.costPerConversation)} c/u` : ""}`} />
      </section>


      <section className="admin-grid" style={{ marginTop: 16 }}>
        <article className="card panel">
          <h2 style={{ marginBottom: 16 }}>Embudo de conversión</h2>
          <FunnelChart steps={report.funnel} />
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>De visitas a leads se cuentan sólo los leads del sitio; los de WhatsApp o referidos no pasan por una visita.</p>
        </article>
        <aside className="card panel" style={{ alignSelf: "start" }}>
          <h2>Gasto por tipo</h2>
          {report.spendByCategory.length === 0 ? <p className="muted">Sin gasto en el período.</p> : (
            <ul className="spend-breakdown">
              {report.spendByCategory.map((item) => (
                <li key={item.category}>
                  <span>{categoryLabel(item.category)}</span>
                  <strong>{money(item.amount)}</strong>
                  <span className="spend-bar" aria-hidden><span style={{ width: `${totals.spend > 0 ? Math.max(2, (item.amount / totals.spend) * 100) : 0}%` }} /></span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted" style={{ fontSize: 13 }}>El consumo de Claudia se suma solo desde el registro de cada respuesta (USD convertidos a {usdRate.toLocaleString("es-CL")} CLP por dólar; ajustable con <code>MARKETING_USD_CLP_RATE</code>).</p>
        </aside>
      </section>
      <div className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h2>Tendencia por {period}</h2><span className="muted" style={{ fontSize: 13 }}>Pasa el cursor sobre una columna para ver el valor</span></div>
        <div className="trend-grid">
          <TrendChart title="Visitas" points={series.points} metric="visits" granularity={series.granularity} format={(value) => integer.format(value)} />
          <TrendChart title="Leads" points={series.points} metric="leads" granularity={series.granularity} format={(value) => integer.format(value)} />
          <TrendChart title="Gasto" points={series.points} metric="spend" granularity={series.granularity} format={(value) => formatMoney(value, currency)} />
        </div>
      </div>
      <div className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h2><Megaphone size={18} /> Rendimiento por procedencia</h2></div>
        <PerformanceTable rows={report.byChannel} money={money} firstColumn="Procedencia" ads={hasAds} empty="Sin visitas, leads ni gastos en el período." />
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>La procedencia sale del enlace con UTM, el sitio desde el que llegó o el canal donde se creó el lead. CAC = gasto ÷ clientes nuevos; los clientes se cuentan entre los leads que entraron en el período. Los leads de anuncios Click-to-WhatsApp aún llegan como WhatsApp.</p>
      </div>

      <div className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h2>Rendimiento por campaña</h2></div>
        <PerformanceTable rows={report.byCampaign} money={money} firstColumn="Campaña" ads={hasAds} empty="Sin campañas en el período. Usa enlaces con utm_campaign en tus anuncios y en la bio para verlas aquí." />
      </div>

      <section style={{ marginTop: 16 }}>
        <article className="card panel">
          <div className="panel-head"><h2>Gastos del período</h2><span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{isMetaAdsSyncConfigured() && <MetaSyncButton />}<ExpenseForm today={today} defaultCurrency={currency} campaigns={campaigns} /></span></div>
          {isMetaAdsSyncConfigured() && <p className="muted" style={{ marginTop: 0 }}>El gasto de Meta Ads se importa solo cada mañana (últimos días, por campaña e Instagram/Facebook). Para cruzarlo con los leads, nombra cada campaña en Meta igual que su <code>utm_campaign</code>.</p>}
          {expenses.length === 0 ? <p className="muted">No hay gastos registrados en el período. Registra la inversión en anuncios (con sus visualizaciones y clics), herramientas o mensajería para calcular el costo por lead y el CAC.</p> : (
            <div className="table-wrap">
              <table className="data-table compact">
                <thead><tr><th>Gasto</th><th>Tipo</th><th>Procedencia / campaña</th><th>Monto</th><th>En el período</th><th /></tr></thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>
                        <strong>{expense.description}</strong>{expense.source === "meta_ads" && <span className="status-pill" style={{ marginLeft: 6 }}>Automático</span>}
                        <span className="muted lead-sub">{day(expense.spentOn)}{expense.recurrence === "monthly" ? ` · mensual${expense.endsOn ? ` hasta ${day(expense.endsOn)}` : ""}` : ""}{expense.impressions !== undefined ? ` · ${integer.format(expense.impressions)} visualiz.` : ""}{expense.clicks !== undefined ? ` · ${integer.format(expense.clicks)} clics` : ""}</span>
                      </td>
                      <td>{expenseCategories[expense.category]}</td>
                      <td>{expense.channel ? leadChannels[expense.channel].label : "General"}{expense.campaign && <span className="muted lead-sub">{expense.campaign}</span>}</td>
                      <td>{formatMoney(expense.amount, expense.currency)}</td>
                      <td>{money(chargesInRange.get(expense.id) ?? 0)}</td>
                      <td><DeleteExpenseButton id={expense.id} description={expense.description} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
