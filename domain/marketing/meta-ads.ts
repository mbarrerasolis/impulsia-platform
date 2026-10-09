import { z } from "zod";
import type { ExpenseCurrency } from "./expenses";
import { normalizeCampaign, type LeadChannel } from "./lead-channel";

/**
 * Gasto diario de Meta Ads por campaña y ubicación, como lo entrega la API de estadísticas
 * (`/act_<id>/insights` con `level=campaign`, `time_increment=1` y `breakdowns=publisher_platform`).
 */
export const metaInsightRowSchema = z.object({
  campaign_id: z.string().min(1),
  campaign_name: z.string().default(""),
  date_start: z.iso.date(),
  spend: z.coerce.number().min(0),
  impressions: z.coerce.number().int().min(0).optional(),
  clicks: z.coerce.number().int().min(0).optional(),
  account_currency: z.string().optional(),
  publisher_platform: z.string().optional(),
});

export type MetaInsightRow = z.infer<typeof metaInsightRowSchema>;

/** Gasto listo para guardar: la referencia externa hace que re-sincronizar un día lo actualice. */
export interface SyncedAdExpense {
  externalRef: string;
  spentOn: string;
  channel: LeadChannel;
  campaign?: string;
  description: string;
  amount: number;
  currency: ExpenseCurrency;
  impressions?: number;
  clicks?: number;
}

const platformChannels: Record<string, LeadChannel> = { instagram: "instagram", facebook: "facebook" };
const platformLabels: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", messenger: "Messenger", audience_network: "Audience Network", threads: "Threads" };

/**
 * Convierte las filas de Meta en gastos de publicidad. Se omiten los días sin gasto y las monedas
 * que el reporte no maneja. La campaña se normaliza igual que `utm_campaign`: si el nombre de la
 * campaña en Meta coincide con el `utm_campaign` de sus anuncios, el costo por lead se cruza solo.
 */
export function adExpensesFromMetaInsights(rows: unknown[]): SyncedAdExpense[] {
  const expenses: SyncedAdExpense[] = [];
  for (const raw of rows) {
    const parsed = metaInsightRowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const row = parsed.data;
    const currency = (row.account_currency ?? "CLP").toUpperCase();
    if (currency !== "CLP" && currency !== "USD") continue;
    const amount = currency === "CLP" ? Math.round(row.spend) : Math.round(row.spend * 100) / 100;
    if (amount <= 0) continue;
    const platform = row.publisher_platform?.toLowerCase() || "meta";
    const name = row.campaign_name.trim() || `Campaña ${row.campaign_id}`;
    const impressions = row.impressions;
    const clicks = row.clicks !== undefined && impressions !== undefined ? Math.min(row.clicks, impressions) : row.clicks;
    expenses.push({
      externalRef: `meta:${row.campaign_id}:${row.date_start}:${platform}`,
      spentOn: row.date_start,
      channel: platformChannels[platform] ?? "meta",
      campaign: normalizeCampaign(name)?.slice(0, 150),
      description: `Meta Ads · ${name}${platformLabels[platform] ? ` · ${platformLabels[platform]}` : ""}`.slice(0, 200),
      amount,
      currency: currency as ExpenseCurrency,
      ...(impressions !== undefined ? { impressions } : {}),
      ...(clicks !== undefined ? { clicks } : {}),
    });
  }
  return expenses;
}

/** Rango de días a re-sincronizar (Meta ajusta el gasto de los últimos días), en la zona horaria de la cuenta. */
export function metaSyncRange(now: Date, days: number, timeZone = "America/Santiago") {
  const format = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const until = format(now);
  const since = format(new Date(now.getTime() - (days - 1) * 86_400_000));
  return { since, until };
}
