import { expenseOccurrences, type ExpenseCurrency } from "@/domain/marketing/expenses";
import { buildMarketingReport, resolveReportRange } from "@/domain/marketing/performance";
import { zonedTimeToUtc } from "@/domain/scheduling/slots";
import { getEditionConfig } from "@/lib/edition";
import { getServerEnv } from "@/lib/env";
import { getMarketingRepository } from "@/repositories";
import type { ReportWindow } from "@/repositories/marketing-repository";

/** Fecha local `YYYY-MM-DD` en la zona del negocio. */
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function localToday(timeZone: string, now = new Date()) {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) dateFormatters.set(timeZone, formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }));
  return formatter.format(now);
}

function dayStart(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  return zonedTimeToUtc({ year, month, day, minutes: 0 }, timeZone);
}

export function reportWindow(range: { from: string; to: string }, timeZone: string): ReportWindow {
  const next = new Date(`${range.to}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    from: range.from,
    to: range.to,
    startsAt: dayStart(range.from, timeZone).toISOString(),
    endsBefore: dayStart(next.toISOString().slice(0, 10), timeZone).toISOString(),
  };
}

/** El reporte va en dólares sólo si la edición vende en dólares; si no, en pesos chilenos. */
export function reportCurrency(): ExpenseCurrency {
  return getEditionConfig().pricing.currency === "USD" ? "USD" : "CLP";
}

export async function getMarketingReport(params: { preset?: string; from?: string; to?: string }) {
  const env = getServerEnv();
  const timeZone = env.ASSISTANT_TIME_ZONE;
  const range = resolveReportRange(params, localToday(timeZone));
  const window = reportWindow(range, timeZone);
  const currency = reportCurrency();
  const rate = env.MARKETING_USD_CLP_RATE;
  const convert = (amount: number, from: ExpenseCurrency) => from === currency ? amount : from === "USD" ? amount * rate : amount / rate;

  const repository = getMarketingRepository();
  const [expenses, leads, aiEvents, visits] = await Promise.all([repository.listExpenses(window), repository.listLeads(window), repository.listAiUsage(window), repository.listVisits(window)]);
  const occurrences = expenseOccurrences(expenses, range, convert);
  const report = buildMarketingReport({
    range,
    leads,
    expenses: occurrences,
    visits,
    aiEvents,
    aiToReport: (usd) => convert(usd, "USD"),
    localDate: (iso) => localToday(timeZone, new Date(iso)),
  });
  return { range, currency, usdRate: rate, expenses, occurrences, report };
}
