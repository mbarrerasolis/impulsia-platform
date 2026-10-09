import { z } from "zod";
import { leadChannelKeys, normalizeCampaign, type LeadChannel } from "./lead-channel";

/** Tipos de gasto comercial que se controlan junto al rendimiento de las campañas. */
export const expenseCategories = {
  advertising: "Publicidad",
  ai: "IA (otros consumos)",
  messaging: "WhatsApp y mensajería",
  tools: "Herramientas y suscripciones",
  content: "Contenido y diseño",
  other: "Otros",
} as const;

export type ExpenseCategory = keyof typeof expenseCategories;
export const expenseCategoryKeys = Object.keys(expenseCategories) as ExpenseCategory[];

export const expenseCurrencies = ["CLP", "USD"] as const;
export type ExpenseCurrency = (typeof expenseCurrencies)[number];

export interface MarketingExpense {
  id: string;
  /** Fecha del gasto (o del primer cargo, si es mensual), `YYYY-MM-DD`. */
  spentOn: string;
  category: ExpenseCategory;
  /** Red o canal al que se imputa (para costo por lead por procedencia). */
  channel?: LeadChannel;
  /** Campaña (mismo nombre que utm_campaign) para el costo por lead de la campaña. */
  campaign?: string;
  description: string;
  amount: number;
  currency: ExpenseCurrency;
  recurrence: "once" | "monthly";
  /** Fecha hasta la que corre un gasto mensual (inclusive), `YYYY-MM-DD`; vacío = sigue vigente. */
  endsOn?: string;
  /** Visualizaciones (impresiones) del anuncio informadas por la plataforma; sólo gastos únicos. */
  impressions?: number;
  /** Clics en el anuncio informados por la plataforma; sólo gastos únicos. */
  clicks?: number;
  /** Importado de una plataforma de anuncios (no se edita a mano: se actualiza al sincronizar). */
  source?: ExpenseSource;
  createdAt: string;
}

export type ExpenseSource = "manual" | "meta_ads";

const isoDate = z.iso.date();
const optionalCount = z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.number().int("Usa un número entero.").min(0).max(2_000_000_000).optional());

export const expenseInputSchema = z.object({
  spentOn: isoDate,
  category: z.enum(expenseCategoryKeys as [ExpenseCategory, ...ExpenseCategory[]]),
  channel: z.preprocess((value) => value === "" ? undefined : value, z.enum(leadChannelKeys as [LeadChannel, ...LeadChannel[]]).optional()),
  campaign: z.preprocess((value) => typeof value === "string" ? normalizeCampaign(value) : value, z.string().max(150).optional()),
  description: z.string().trim().min(2, "Describe el gasto.").max(200),
  amount: z.coerce.number().positive("El monto debe ser mayor a cero.").max(1_000_000_000),
  currency: z.enum(expenseCurrencies).default("CLP"),
  recurrence: z.enum(["once", "monthly"]).default("once"),
  endsOn: z.preprocess((value) => value === "" ? undefined : value, isoDate.optional()),
  impressions: optionalCount,
  clicks: optionalCount,
})
  .refine((value) => !value.endsOn || value.endsOn >= value.spentOn, { message: "El término no puede ser anterior al inicio.", path: ["endsOn"] })
  .refine((value) => value.recurrence === "once" || (value.impressions === undefined && value.clicks === undefined), { message: "Visualizaciones y clics se registran en gastos únicos (el resultado de una campaña o período).", path: ["impressions"] })
  .refine((value) => value.clicks === undefined || value.impressions === undefined || value.clicks <= value.impressions, { message: "Los clics no pueden superar las visualizaciones.", path: ["clicks"] });

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

/** Un cargo concreto dentro del período (un gasto mensual genera uno por mes). */
export interface ExpenseOccurrence {
  expense: MarketingExpense;
  date: string;
  /** Monto en la moneda del reporte. */
  amount: number;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Cargos de cada gasto entre `from` y `to` (fechas `YYYY-MM-DD`, ambas inclusive). Un gasto mensual
 * se repite el mismo día de cada mes (o el último día, si el mes es más corto) hasta `endsOn`.
 */
export function expenseOccurrences(expenses: MarketingExpense[], range: { from: string; to: string }, toReportCurrency: (amount: number, currency: ExpenseCurrency) => number): ExpenseOccurrence[] {
  const result: ExpenseOccurrence[] = [];
  for (const expense of expenses) {
    const amount = toReportCurrency(expense.amount, expense.currency);
    if (expense.recurrence === "once") {
      if (expense.spentOn >= range.from && expense.spentOn <= range.to) result.push({ expense, date: expense.spentOn, amount });
      continue;
    }
    const [startYear, startMonth, startDay] = expense.spentOn.split("-").map(Number);
    const last = expense.endsOn && expense.endsOn < range.to ? expense.endsOn : range.to;
    for (let offset = 0; offset < 1200; offset += 1) {
      const year = startYear + Math.floor((startMonth - 1 + offset) / 12);
      const monthIndex = (startMonth - 1 + offset) % 12;
      const day = Math.min(startDay, daysInMonth(year, monthIndex));
      const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (date > last) break;
      if (date >= range.from) result.push({ expense, date, amount });
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
