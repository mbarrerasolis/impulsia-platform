import type { LeadAttribution } from "@/domain/marketing/attribution";
import type { ExpenseInput, MarketingExpense, ExpenseSource } from "@/domain/marketing/expenses";
import type { SyncedAdExpense } from "@/domain/marketing/meta-ads";
import type { AiUsageEvent, ReportLead, ReportVisit } from "@/domain/marketing/performance";

/** Instantes UTC del período del reporte (inicio inclusive, fin exclusivo). */
export interface ReportWindow {
  /** Fechas locales `YYYY-MM-DD` (inclusive) para los gastos. */
  from: string;
  to: string;
  startsAt: string;
  endsBefore: string;
}

export interface VisitInput {
  sessionId: string;
  attribution?: LeadAttribution;
  landingPath?: string;
}

export interface MarketingRepository {
  /** Gastos que pueden tener cargos en el período: únicos dentro de él y mensuales iniciados antes de su fin. */
  listExpenses(window: ReportWindow): Promise<MarketingExpense[]>;
  createExpense(input: ExpenseInput, createdBy?: string): Promise<MarketingExpense>;
  deleteExpense(id: string): Promise<void>;
  /** Inserta o actualiza gastos importados de una plataforma de anuncios, por su referencia externa. */
  upsertSyncedExpenses(source: ExpenseSource, expenses: SyncedAdExpense[]): Promise<number>;
  listLeads(window: ReportWindow): Promise<ReportLead[]>;
  listAiUsage(window: ReportWindow): Promise<AiUsageEvent[]>;
  listVisits(window: ReportWindow): Promise<ReportVisit[]>;
  /** Registra una sesión del sitio; si la sesión ya existe no hace nada. */
  recordVisit(input: VisitInput): Promise<void>;
}
