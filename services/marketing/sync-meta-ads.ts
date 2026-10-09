import { adExpensesFromMetaInsights, metaSyncRange } from "@/domain/marketing/meta-ads";
import type { MarketingRepository } from "@/repositories/marketing-repository";

export interface MetaAdsSyncResult {
  since: string;
  until: string;
  /** Filas que devolvió Meta (campaña × día × ubicación). */
  rows: number;
  /** Gastos guardados o actualizados (las filas sin gasto se omiten). */
  saved: number;
}

/**
 * Trae de Meta el gasto de los últimos `days` días y lo deja en Campañas y gastos. Re-sincronizar es
 * seguro: cada campaña, día y ubicación tiene una referencia única y se actualiza en vez de duplicarse.
 */
export async function syncMetaAdSpend(input: {
  repository: Pick<MarketingRepository, "upsertSyncedExpenses">;
  fetchInsights: (range: { since: string; until: string }) => Promise<unknown[]>;
  days: number;
  now?: Date;
}): Promise<MetaAdsSyncResult> {
  const range = metaSyncRange(input.now ?? new Date(), input.days);
  const rows = await input.fetchInsights(range);
  const saved = await input.repository.upsertSyncedExpenses("meta_ads", adExpensesFromMetaInsights(rows));
  return { ...range, rows: rows.length, saved };
}
