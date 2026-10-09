import { getEditionConfig } from "@/lib/edition";
import { formatMoney } from "@/lib/format";

export default function PricingPage() {
  const { pricing: rules, catalog, locale } = getEditionConfig();
  const money = (amount: number) => formatMoney(amount, rules.currency, locale);

  return <>
    <div className="admin-title">
      <div><h1>Reglas de pricing</h1><p className="muted">Versión {rules.version} · efectiva desde {rules.effectiveFrom} · moneda {rules.currency}.</p></div>
      <span className="state active">● Configuración de edición</span>
    </div>
    <section className="stat-grid">
      <article className="card stat"><div className="stat-top">Valor jornada</div><div className="stat-value">{money(rules.dayRate)}</div></article>
      <article className="card stat"><div className="stat-top">Implementación mínima</div><div className="stat-value">{money(rules.minimumImplementation)}</div></article>
      <article className="card stat"><div className="stat-top">Mantención mínima</div><div className="stat-value">{money(rules.minimumMaintenance)}</div></article>
      <article className="card stat"><div className="stat-top">Redondeo comercial</div><div className="stat-value">{money(rules.roundingMultiple)}</div></article>
    </section>
    <section className="admin-grid">
      <article className="card panel">
        <h2>Tramos de mantención</h2>
        <table className="data-table"><thead><tr><th>Hasta</th><th>Tasa</th><th>Piso</th></tr></thead><tbody>{rules.maintenanceBrackets.map((bracket,index)=><tr key={index}><td>{bracket.upTo?money(bracket.upTo):"Sin límite"}</td><td>{bracket.ratePercent}%</td><td>{money(bracket.floor)}</td></tr>)}</tbody></table>
      </article>
      <article className="card panel">
        <h2>Beneficio de expansión</h2>
        {rules.expansionDiscountTiers.map(tier=><div className="pipeline-row" style={{gridTemplateColumns:"1fr auto"}} key={tier.fromSolution}><span>Desde solución N° {tier.fromSolution}</span><strong>{tier.discountPercent}%</strong></div>)}
      </article>
    </section>
    <section className="card panel" style={{marginTop:16}}>
      <div className="panel-head"><h2>Catálogo comercial</h2><span className="muted">{catalog.length} plantillas configuradas</span></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Solución</th><th>Categoría</th><th>Jornadas</th><th>Complejidad</th></tr></thead><tbody>{catalog.map(item=><tr key={item.key}><td><strong>{item.name}</strong><br/><small className="muted">{item.description}</small></td><td>{item.category}</td><td>{item.defaultDays}</td><td>{item.defaultComplexity}</td></tr>)}</tbody></table></div>
    </section>
  </>;
}
