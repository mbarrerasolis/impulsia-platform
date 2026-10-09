import Link from "next/link";
import { AlertCircle, ArrowUpRight, Boxes, CircleDollarSign, MessageSquare, ShoppingBag, Star, Users, Workflow } from "lucide-react";
import { formatClp } from "@/lib/format";
import { getVocabulary, isModuleEnabled } from "@/lib/business";
import { getReadModelRepository } from "@/repositories";
import { getStoreDashboard } from "@/services/store/dashboard";

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat(process.env.NEXT_PUBLIC_COMMERCE_LOCALE || "es-CL", {
    style: "currency",
    currency: process.env.NEXT_PUBLIC_COMMERCE_CURRENCY || "CLP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default async function DashboardPage() {
  const readModel = getReadModelRepository();
  const { snapshot, accountTotal, leadTotal, hasOperation } = await readModel.getDashboardReadModel();
  // Sin soluciones y cobranza (p. ej. venta de productos) no hay MRR, implementaciones ni cuotas que mostrar.
  const subscriptions = isModuleEnabled("subscriptions");
  const vocabulary = getVocabulary();
  const store = isModuleEnabled("store") ? await getStoreDashboard() : null;

  const alerts = [
    subscriptions && snapshot.overduePeriods > 0
      ? {
          icon: <AlertCircle size={15} style={{ verticalAlign: "middle", marginRight: 8, color: "#b42318" }} />,
          text: `${snapshot.overduePeriods} ${snapshot.overduePeriods === 1 ? "cuota vencida" : "cuotas vencidas"} por ${formatClp(snapshot.overdueAmount)}`,
          label: "Cobranza",
          href: "/admin/billing" as const,
        }
      : null,
    subscriptions && (snapshot.blockedTasks > 0 || snapshot.overdueTasks > 0)
      ? {
          icon: <Workflow size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />,
          text: `${snapshot.blockedTasks} bloqueadas · ${snapshot.overdueTasks} atrasadas`,
          label: "Implementación",
          href: "/admin/solutions" as const,
        }
      : null,
    store && store.waitingConversations > 0
      ? { icon: <MessageSquare size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />, text: `${store.waitingConversations} ${store.waitingConversations === 1 ? "conversación espera" : "conversaciones esperan"} a una persona`, label: "Conversaciones", href: "/admin/conversations" as const }
      : null,
    store && (store.outOfStock > 0 || store.lowStock > 0)
      ? { icon: <Boxes size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />, text: `${store.outOfStock} sin stock · ${store.lowStock} con stock bajo`, label: "Inventario", href: "/admin/inventory" as const }
      : null,
    store && store.pendingReviews > 0
      ? { icon: <Star size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />, text: `${store.pendingReviews} ${store.pendingReviews === 1 ? "reseña por revisar" : "reseñas por revisar"}`, label: "Reseñas", href: "/admin/reviews" as const }
      : null,
    snapshot.newLeads > 0
      ? {
          icon: <Users size={15} style={{ verticalAlign: "middle", marginRight: 8 }} />,
          text: `${snapshot.newLeads} ${snapshot.newLeads === 1 ? "lead nuevo requiere" : "leads nuevos requieren"} seguimiento`,
          label: "CRM",
          href: "/admin/crm" as const,
        }
      : null,
  ].filter((alert): alert is NonNullable<typeof alert> => alert !== null);

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Resumen ejecutivo</h1>
          <p className="muted">{subscriptions ? "Datos reales de ventas, implementación y cobranza." : "Datos reales de ventas y clientes."}</p>
        </div>
        {store ? <Link href="/" className="btn btn-secondary" target="_blank">Ver tienda</Link> : <Link href="/diagnostico" className="btn btn-primary">{subscriptions ? "Nuevo diagnóstico" : "Nuevo lead"}</Link>}
      </div>

      {subscriptions ? <>
      <section className="stat-grid">
        <article className="card stat">
          <div className="stat-top"><span>MRR actual</span><CircleDollarSign size={17} /></div>
          <div className="stat-value">{formatClp(snapshot.currentMrr)}</div>
          <div className="stat-change">Calculado directamente en la base de datos</div>
        </article>
        <article className="card stat">
          <div className="stat-top"><span>Clientes activos</span><Users size={17} /></div>
          <div className="stat-value">{snapshot.activeClients}</div>
          <div className="stat-change">{accountTotal} {vocabulary.accounts.toLowerCase()} en total</div>
        </article>
        <article className="card stat">
          <div className="stat-top"><span>Expansión MRR</span><ArrowUpRight size={17} /></div>
          <div className="stat-value">{formatClp(snapshot.expansionMrrThisMonth)}</div>
          <div className="stat-change">{snapshot.soldSolutionsThisMonth} soluciones vendidas este mes</div>
        </article>
        <article className="card stat">
          <div className="stat-top"><span>Implementaciones activas</span><Workflow size={17} /></div>
          <div className="stat-value">{snapshot.activeImplementations}</div>
          <div className="stat-change">{snapshot.blockedTasks} tareas bloqueadas</div>
        </article>
      </section>
      </> : <>
      <section className="stat-grid">
        {store && <>
        <article className="card stat">
          <div className="stat-top"><span>Pedidos web</span><ShoppingBag size={17} /></div>
          <div className="stat-value">{store.ordersWeek}</div>
          <div className="stat-change">últimos 7 días · {store.ordersToday} en 24 horas</div>
        </article>
        <article className="card stat">
          <div className="stat-top"><span>Stock</span><Boxes size={17} /></div>
          <div className="stat-value">{store.outOfStock + store.lowStock}</div>
          <div className="stat-change">{store.outOfStock} sin stock · {store.lowStock} stock bajo</div>
        </article>
        </>}
        <article className="card stat">
          <div className="stat-top"><span>Leads</span><Users size={17} /></div>
          <div className="stat-value">{leadTotal}</div>
          <div className="stat-change">{snapshot.newLeads} nuevos por atender</div>
        </article>
        <article className="card stat">
          <div className="stat-top"><span>{vocabulary.accounts}</span><CircleDollarSign size={17} /></div>
          <div className="stat-value">{accountTotal}</div>
          <div className="stat-change">{snapshot.activeClients} activos</div>
        </article>
      </section>
      </>}

      <section className="admin-grid" style={subscriptions ? undefined : { gridTemplateColumns: "1fr" }}>
        {subscriptions && <>
        <article className="card panel">
          <div className="panel-head">
            <h2>Facturación emitida</h2>
            <span className="muted" style={{ fontSize: 12 }}>Últimos 6 meses</span>
          </div>
          <div className="bars">
            {snapshot.billingMonths.map((month) => (
              <div className="bar-wrap" key={month.key} title={`${month.label}: ${formatClp(month.amount)}`}>
                <div className="bar" style={{ height: `${month.height}%`, opacity: month.amount === 0 ? 0.22 : 1 }} />
                <strong>{formatCompactMoney(month.amount)}</strong>
                <span>{month.label}</span>
              </div>
            ))}
          </div>
          <div className="pipeline-row" style={{ marginTop: 14 }}>
            <strong>Por cobrar</strong><span></span><strong>{formatClp(snapshot.receivableAmount)}</strong>
          </div>
        </article>
        </>}

        <article className="card panel">
          <div className="panel-head">
            <h2>Pipeline comercial</h2>
            <span className={`state ${leadTotal ? "active" : "prospect"}`}>● {leadTotal} leads</span>
          </div>
          {snapshot.pipeline.map((stage) => (
            <div className="pipeline-row" key={stage.status}>
              <strong>{stage.label}</strong><span>{stage.count}</span><span>{stage.share}%</span>
            </div>
          ))}
        </article>
      </section>

      <section className="card panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h2>Alertas y próximas acciones</h2>
          <span className={`state ${alerts.length ? "paused" : "active"}`}>● {alerts.length ? `${alerts.length} pendientes` : "Al día"}</span>
        </div>
        {alerts.length ? alerts.map((alert) => (
          <div className="pipeline-row" key={alert.label}>
            <span>{alert.icon}{alert.text}</span>
            <span></span>
            <Link href={alert.href}><strong>{alert.label}</strong></Link>
          </div>
        )) : (
          <div className="success-box" style={{ paddingBlock: hasOperation ? 26 : 34 }}>
            <h2>{hasOperation ? "No hay alertas pendientes" : "La operación está lista para comenzar"}</h2>
            <p className="muted">
              {hasOperation
                ? (subscriptions ? "Cobranza, tareas y leads nuevos están al día." : "Los leads nuevos están al día.")
                : "Crea el primer diagnóstico y este panel se actualizará automáticamente."}
            </p>
            {!hasOperation && <Link href="/diagnostico" className="btn btn-secondary">Crear primer diagnóstico</Link>}
          </div>
        )}
      </section>
    </>
  );
}
