import { describe, expect, it } from "vitest";
import type { AccountSummary, Lead } from "@/domain/crm/entities";
import type {
  BillingPeriodRecord,
  ClientSolutionRecord,
  ImplementationTaskRecord,
} from "@/domain/operations/entities";
import { buildDashboardSnapshot, buildDashboardSnapshotFromMetrics } from "./dashboard";

const accounts: AccountSummary[] = [
  { id: "a1", tradeName: "Uno", legalName: "Uno SpA", status: "active", industry: "TI", contactCount: 1, activeSolutions: 1, mrr: 100_000 },
  { id: "a2", tradeName: "Dos", legalName: "Dos SpA", status: "prospect", industry: "Salud", contactCount: 1, activeSolutions: 0, mrr: 0 },
];

const leads: Lead[] = [
  { id: "l1", source: "web", name: "Ana", company: "Uno", email: "ana@example.com", rawNeedDescription: "Automatizar", systems: [], apiKnowledge: "unknown", primaryGoal: "Ahorrar tiempo", status: "new", score: 60, consentGiven: true, createdAt: "2026-09-01T00:00:00.000Z" },
  { id: "l2", source: "referral", name: "Luis", company: "Dos", email: "luis@example.com", rawNeedDescription: "Integrar", systems: [], apiKnowledge: "yes", primaryGoal: "Integrar", status: "qualified", score: 80, consentGiven: true, createdAt: "2026-09-02T00:00:00.000Z" },
];

const solution: ClientSolutionRecord = {
  id: "s1", accountId: "a1", quoteId: "q1", name: "Automatización", status: "development",
  estimatedDays: 5, complexityFactor: 1, dayRateSnapshot: 100_000, grossImplementationPrice: 500_000,
  expansionDiscountPercent: 0, netImplementationPrice: 500_000, grossMaintenanceIncrement: 50_000,
  maintenanceDiscountPercent: 0, netMaintenanceIncrement: 50_000,
  pricingSnapshot: { version: "test", effectiveFrom: "2026-01-01", currency: "CLP", dayRate: 100_000, minimumImplementation: 100_000, minimumMaintenance: 20_000, roundingMultiple: 1_000, complexityFactors: { standard: 1, medium: 1.2, high: 1.5, research: 1.8, advanced_research: 2 }, maintenanceBrackets: [], expansionDiscountTiers: [] },
  createdAt: "2026-09-05T00:00:00.000Z",
};

const billingPeriod: BillingPeriodRecord = {
  id: "b1", subscriptionId: "sub1", accountId: "a1", periodStart: "2026-09-01", periodEnd: "2026-09-30",
  dueDate: "2026-09-10", amountDue: 100_000, amountPaid: 20_000, status: "overdue",
  pricingSnapshot: { subscriptionItemIds: [], generatedAt: "2026-09-01T00:00:00.000Z" },
};

const tasks: ImplementationTaskRecord[] = [
  { id: "t1", clientSolutionId: "s1", title: "Desbloquear", status: "blocked", dueDate: "2026-09-15", createdAt: "2026-09-01T00:00:00.000Z" },
];

describe("buildDashboardSnapshot", () => {
  it("calcula KPIs, cobranza, pipeline y alertas desde los registros reales", () => {
    const result = buildDashboardSnapshot({
      accounts,
      leads,
      solutions: [solution],
      billingPeriods: [billingPeriod],
      tasks,
      now: new Date("2026-09-17T12:00:00.000Z"),
    });

    expect(result.currentMrr).toBe(100_000);
    expect(result.activeClients).toBe(1);
    expect(result.expansionMrrThisMonth).toBe(50_000);
    expect(result.activeImplementations).toBe(1);
    expect(result.receivableAmount).toBe(80_000);
    expect(result.overdueAmount).toBe(80_000);
    expect(result.blockedTasks).toBe(1);
    expect(result.overdueTasks).toBe(1);
    expect(result.billingMonths.at(-1)).toMatchObject({ key: "2026-09", amount: 100_000, height: 100 });
    expect(result.pipeline.find((stage) => stage.status === "new")).toMatchObject({ count: 1, share: 50 });
  });

  it("devuelve porcentajes y barras en cero cuando todavía no hay operación", () => {
    const result = buildDashboardSnapshot({ accounts: [], leads: [], solutions: [], billingPeriods: [], tasks: [], now: new Date("2026-09-17T12:00:00.000Z") });
    expect(result.currentMrr).toBe(0);
    expect(result.billingMonths).toHaveLength(6);
    expect(result.billingMonths.every((month) => month.height === 0)).toBe(true);
    expect(result.pipeline.every((stage) => stage.share === 0)).toBe(true);
  });

  it("construye la misma vista desde agregados de base sin cargar colecciones completas", () => {
    const result = buildDashboardSnapshotFromMetrics({
      currentMrr: 100_000,
      activeClients: 1,
      expansionMrrThisMonth: 50_000,
      activeImplementations: 1,
      receivableAmount: 80_000,
      overdueAmount: 80_000,
      overduePeriods: 1,
      blockedTasks: 1,
      overdueTasks: 1,
      newLeads: 1,
      soldSolutionsThisMonth: 1,
      billingByMonth: { "2026-09": 100_000 },
      pipelineCounts: { new: 1, qualified: 1 },
    }, new Date("2026-09-17T12:00:00.000Z"));

    expect(result.billingMonths.at(-1)).toMatchObject({ key: "2026-09", amount: 100_000, height: 100 });
    expect(result.pipeline.find((stage) => stage.status === "new")).toMatchObject({ count: 1, share: 50 });
    expect(result.receivableAmount).toBe(80_000);
  });
});
