import type { ExpenseInput, ExpenseSource, MarketingExpense } from "@/domain/marketing/expenses";
import type { SyncedAdExpense } from "@/domain/marketing/meta-ads";
import type { ReportVisit } from "@/domain/marketing/performance";
import type { MarketingRepository, ReportWindow, VisitInput } from "../marketing-repository";
import { demoStore } from "./demo-store";

const globalForDemo = globalThis as unknown as { impulsiaDemoExpenses?: MarketingExpense[]; impulsiaDemoVisits?: Map<string, ReportVisit> };
const expenses = globalForDemo.impulsiaDemoExpenses ??= [];
const visits = globalForDemo.impulsiaDemoVisits ??= new Map();

export class MemoryMarketingRepository implements MarketingRepository {
  async listExpenses(window: ReportWindow) {
    return expenses.filter((expense) => expense.spentOn <= window.to && (expense.recurrence === "monthly" ? !expense.endsOn || expense.endsOn >= window.from : expense.spentOn >= window.from));
  }
  async createExpense(input: ExpenseInput) {
    const expense: MarketingExpense = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    expenses.unshift(expense);
    return expense;
  }
  async upsertSyncedExpenses(source: ExpenseSource, synced: SyncedAdExpense[]) {
    for (const item of synced) {
      const { externalRef, ...rest } = item;
      const existing = expenses.findIndex((expense) => expense.id === externalRef);
      const expense: MarketingExpense = { ...rest, id: externalRef, category: "advertising", recurrence: "once", source, createdAt: new Date().toISOString() };
      if (existing >= 0) expenses[existing] = expense; else expenses.unshift(expense);
    }
    return synced.length;
  }
  async deleteExpense(id: string) {
    const index = expenses.findIndex((expense) => expense.id === id);
    if (index < 0) throw new Error("Gasto no encontrado.");
    expenses.splice(index, 1);
  }
  async listLeads(window: ReportWindow) {
    return demoStore.leads.filter((lead) => lead.createdAt >= window.startsAt && lead.createdAt < window.endsBefore);
  }
  async listAiUsage() {
    return [];
  }
  async listVisits(window: ReportWindow) {
    return [...visits.values()].filter((visit) => visit.visitedAt >= window.startsAt && visit.visitedAt < window.endsBefore);
  }
  async recordVisit(input: VisitInput) {
    if (!visits.has(input.sessionId)) visits.set(input.sessionId, { visitedAt: new Date().toISOString(), attribution: input.attribution });
  }
}
