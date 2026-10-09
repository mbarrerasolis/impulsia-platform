import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, CircleDollarSign, PackageCheck, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { clientRoles, requireRole, type AppRole } from "@/lib/auth/authorization";
import { getBrandConfig } from "@/lib/brand";
import { getServerEnv } from "@/lib/env";
import { formatClp } from "@/lib/format";
import { getReadModelRepository } from "@/repositories";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal", robots: { index: false, follow: false } };

const billingRoles: readonly AppRole[] = ["client_admin", "client_billing"];
const solutionRoles: readonly AppRole[] = ["client_admin", "client_technical", "client_viewer"];

const roleLabels: Partial<Record<AppRole, string>> = {
  client_admin: "Administrador cliente",
  client_billing: "Facturación",
  client_technical: "Equipo técnico",
  client_viewer: "Consulta",
};

export default async function PortalPage() {
  const env = getServerEnv();
  const brand = getBrandConfig();
  const authenticatedPrincipal = await requireRole(clientRoles);
  const principal = env.APP_MODE === "demo"
    ? { ...authenticatedPrincipal, role: "client_admin" as AppRole, accountId: "a1" }
    : authenticatedPrincipal;

  if (!principal.accountId) notFound();

  const repository = getReadModelRepository();
  const [account, allSolutions, allPeriods] = await Promise.all([
    repository.findAccount(principal.accountId),
    solutionRoles.includes(principal.role) ? repository.listPortalSolutions() : Promise.resolve([]),
    billingRoles.includes(principal.role) ? repository.listBillingPeriods() : Promise.resolve([]),
  ]);

  if (!account) notFound();

  const solutions = allSolutions.filter((item) => item.accountId === account.id);
  const periods = allPeriods.filter((item) => item.accountId === account.id);
  const pendingAmount = periods
    .filter((item) => item.status === "pending" || item.status === "overdue")
    .reduce((total, item) => total + Math.max(0, item.amountDue - item.amountPaid), 0);
  const canViewBilling = billingRoles.includes(principal.role);
  const canViewSolutions = solutionRoles.includes(principal.role);

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="container nav">
          <Link href="/" aria-label={`${brand.name}, inicio`}><Brand name={brand.name} /></Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="demo-badge">{env.APP_MODE === "demo" ? "PORTAL DEMO" : roleLabels[principal.role]}</span>
            <Link href="/" className="btn btn-secondary" style={{ minHeight: 38 }}>Salir</Link>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingBlock: 42, minHeight: "calc(100vh - 70px)" }}>
        <div className="admin-title">
          <div>
            <span className="eyebrow"><ShieldCheck size={14} /> Área privada</span>
            <h1 style={{ marginTop: 16 }}>Hola, {account.tradeName}</h1>
            <p className="muted">Consulta el estado de tus soluciones y la información disponible para tu rol.</p>
          </div>
          <span className={`state ${account.status}`}>● {account.status}</span>
        </div>

        <section className="stat-grid">
          <article className="card stat">
            <div className="stat-top"><span>Cuenta</span><Building2 size={17} /></div>
            <div className="stat-value" style={{ fontSize: 22 }}>{account.tradeName}</div>
            <div className="stat-change">{roleLabels[principal.role]}</div>
          </article>
          {canViewSolutions && (
            <article className="card stat">
              <div className="stat-top"><span>Soluciones visibles</span><PackageCheck size={17} /></div>
              <div className="stat-value">{solutions.length}</div>
              <div className="stat-change">seguimiento operativo</div>
            </article>
          )}
          {canViewBilling && (
            <>
              <article className="card stat">
                <div className="stat-top"><span>Saldo pendiente</span><CircleDollarSign size={17} /></div>
                <div className="stat-value">{formatClp(pendingAmount)}</div>
                <div className="stat-change">según períodos emitidos</div>
              </article>
              <article className="card stat">
                <div className="stat-top"><span>Períodos</span><CircleDollarSign size={17} /></div>
                <div className="stat-value">{periods.length}</div>
                <div className="stat-change">historial de facturación</div>
              </article>
            </>
          )}
        </section>

        {canViewSolutions && (
          <section className="card panel" style={{ marginTop: 18 }}>
            <div className="panel-head"><h2>Mis soluciones</h2><span className="muted" style={{ fontSize: 12 }}>Vista operativa</span></div>
            {solutions.length ? (
              <div className="table-wrap"><table className="data-table">
                <thead><tr><th>Solución</th><th>Estado</th><th>Jornadas estimadas</th></tr></thead>
                <tbody>{solutions.map((solution) => <tr key={solution.id}>
                  <td><strong>{solution.name}</strong></td>
                  <td><span className="state active">● {solution.status}</span></td>
                  <td>{solution.estimatedDays}</td>
                </tr>)}</tbody>
              </table></div>
            ) : <p className="muted">Aún no hay soluciones asociadas a esta cuenta.</p>}
          </section>
        )}

        {canViewBilling && (
          <section className="card panel" style={{ marginTop: 18 }}>
            <div className="panel-head"><h2>Facturación</h2><span className="muted" style={{ fontSize: 12 }}>Montos en CLP</span></div>
            {periods.length ? (
              <div className="table-wrap"><table className="data-table">
                <thead><tr><th>Período</th><th>Vencimiento</th><th>Monto</th><th>Pagado</th><th>Estado</th></tr></thead>
                <tbody>{periods.map((period) => <tr key={period.id}>
                  <td>{period.periodStart} → {period.periodEnd}</td>
                  <td>{period.dueDate}</td>
                  <td><strong>{formatClp(period.amountDue)}</strong></td>
                  <td>{formatClp(period.amountPaid)}</td>
                  <td><span className={`state ${period.status === "paid" ? "active" : period.status === "overdue" ? "paused" : "prospect"}`}>● {period.status}</span></td>
                </tr>)}</tbody>
              </table></div>
            ) : <p className="muted">Aún no hay períodos de facturación emitidos.</p>}
          </section>
        )}
      </main>
    </div>
  );
}
