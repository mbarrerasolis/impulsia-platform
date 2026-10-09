import type { AccountSummary, Lead } from "@/domain/crm/entities";
import type {
  BillingPeriodRecord,
  ClientSolutionRecord,
  ImplementationTaskRecord,
} from "@/domain/operations/entities";

const pipelineLabels: Record<Lead["status"], string> = {
  new: "Nuevos",
  contacted: "Contactados",
  qualified: "Calificados",
  converted: "Convertidos",
  lost: "Perdidos",
};

const activeImplementationStatuses = new Set<ClientSolutionRecord["status"]>([
  "approved",
  "development",
  "testing",
]);

export interface DashboardSnapshot {
  currentMrr: number;
  activeClients: number;
  expansionMrrThisMonth: number;
  activeImplementations: number;
  receivableAmount: number;
  overdueAmount: number;
  overduePeriods: number;
  blockedTasks: number;
  overdueTasks: number;
  newLeads: number;
  soldSolutionsThisMonth: number;
  billingMonths: Array<{ key: string; label: string; amount: number; height: number }>;
  pipeline: Array<{ status: Lead["status"]; label: string; count: number; share: number }>;
}

export interface DashboardMetrics {
  currentMrr: number;
  activeClients: number;
  expansionMrrThisMonth: number;
  activeImplementations: number;
  receivableAmount: number;
  overdueAmount: number;
  overduePeriods: number;
  blockedTasks: number;
  overdueTasks: number;
  newLeads: number;
  soldSolutionsThisMonth: number;
  billingByMonth: Record<string, number>;
  pipelineCounts: Partial<Record<Lead["status"], number>>;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonths(now: Date, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - index - 1), 1));
    const label = new Intl.DateTimeFormat("es-CL", { month: "short", timeZone: "UTC" })
      .format(date)
      .replace(".", "");
    return { key: monthKey(date), label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

export function buildDashboardSnapshot(input: {
  accounts: AccountSummary[];
  leads: Lead[];
  solutions: ClientSolutionRecord[];
  billingPeriods: BillingPeriodRecord[];
  tasks: ImplementationTaskRecord[];
  now?: Date;
}): DashboardSnapshot {
  const now = input.now ?? new Date();
  const currentMonth = monthKey(now);
  const today = now.toISOString().slice(0, 10);
  const soldThisMonth = input.solutions.filter(
    (solution) => solution.status !== "cancelled" && solution.createdAt.slice(0, 7) === currentMonth,
  );
  const billablePeriods = input.billingPeriods.filter((period) => period.status !== "void");
  const months = previousMonths(now, 6).map((month) => ({
    ...month,
    amount: billablePeriods
      .filter((period) => period.periodStart.slice(0, 7) === month.key)
      .reduce((sum, period) => sum + period.amountDue, 0),
  }));
  const maxBilling = Math.max(...months.map((month) => month.amount), 0);
  const pipelineTotal = input.leads.length;

  return {
    currentMrr: input.accounts.reduce((sum, account) => sum + account.mrr, 0),
    activeClients: input.accounts.filter((account) => account.status === "active").length,
    expansionMrrThisMonth: soldThisMonth.reduce(
      (sum, solution) => sum + solution.netMaintenanceIncrement,
      0,
    ),
    activeImplementations: input.solutions.filter((solution) =>
      activeImplementationStatuses.has(solution.status),
    ).length,
    receivableAmount: billablePeriods
      .filter((period) => period.status !== "paid")
      .reduce((sum, period) => sum + Math.max(period.amountDue - period.amountPaid, 0), 0),
    overdueAmount: billablePeriods
      .filter((period) => period.status === "overdue")
      .reduce((sum, period) => sum + Math.max(period.amountDue - period.amountPaid, 0), 0),
    overduePeriods: billablePeriods.filter((period) => period.status === "overdue").length,
    blockedTasks: input.tasks.filter((task) => task.status === "blocked").length,
    overdueTasks: input.tasks.filter(
      (task) => task.status !== "done" && Boolean(task.dueDate) && task.dueDate! < today,
    ).length,
    newLeads: input.leads.filter((lead) => lead.status === "new").length,
    soldSolutionsThisMonth: soldThisMonth.length,
    billingMonths: months.map((month) => ({
      ...month,
      height: maxBilling === 0 ? 0 : Math.max(8, Math.round((month.amount / maxBilling) * 100)),
    })),
    pipeline: (Object.keys(pipelineLabels) as Lead["status"][]).map((status) => {
      const count = input.leads.filter((lead) => lead.status === status).length;
      return {
        status,
        label: pipelineLabels[status],
        count,
        share: pipelineTotal === 0 ? 0 : Math.round((count / pipelineTotal) * 100),
      };
    }),
  };
}

export function buildDashboardSnapshotFromMetrics(metrics: DashboardMetrics, now = new Date()): DashboardSnapshot {
  const months = previousMonths(now, 6).map((month) => ({
    ...month,
    amount: Number(metrics.billingByMonth[month.key] ?? 0),
  }));
  const maxBilling = Math.max(...months.map((month) => month.amount), 0);
  const pipelineTotal = Object.values(metrics.pipelineCounts).reduce((sum, count) => sum + Number(count ?? 0), 0);

  return {
    currentMrr: metrics.currentMrr,
    activeClients: metrics.activeClients,
    expansionMrrThisMonth: metrics.expansionMrrThisMonth,
    activeImplementations: metrics.activeImplementations,
    receivableAmount: metrics.receivableAmount,
    overdueAmount: metrics.overdueAmount,
    overduePeriods: metrics.overduePeriods,
    blockedTasks: metrics.blockedTasks,
    overdueTasks: metrics.overdueTasks,
    newLeads: metrics.newLeads,
    soldSolutionsThisMonth: metrics.soldSolutionsThisMonth,
    billingMonths: months.map((month) => ({
      ...month,
      height: maxBilling === 0 ? 0 : Math.max(8, Math.round((month.amount / maxBilling) * 100)),
    })),
    pipeline: (Object.keys(pipelineLabels) as Lead["status"][]).map((status) => {
      const count = Number(metrics.pipelineCounts[status] ?? 0);
      return {
        status,
        label: pipelineLabels[status],
        count,
        share: pipelineTotal === 0 ? 0 : Math.round((count / pipelineTotal) * 100),
      };
    }),
  };
}
