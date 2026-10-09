import type { Lead } from "@/domain/crm/entities";
import { leadTemperature } from "@/domain/crm/lead-temperature";
import type { LeadAttribution } from "./attribution";
import { expenseCategoryKeys, type ExpenseCategory, type ExpenseOccurrence } from "./expenses";
import { leadChannels, leadOrigin, normalizeCampaign, type LeadChannel } from "./lead-channel";

export type ReportLead = Pick<Lead, "id" | "source" | "status" | "score" | "attribution" | "createdAt">;

/** Una sesión anónima del sitio público con el origen que tenía al llegar. */
export interface ReportVisit {
  visitedAt: string;
  attribution?: LeadAttribution;
}

/** Una respuesta del asistente con IA (costo en USD desde `ai_usage_events`). */
export interface AiUsageEvent {
  createdAt: string;
  costUsd: number;
  conversationId?: string;
}

interface Counts {
  leads: number;
  /** Leads que llegaron por el sitio (formulario), los únicos que pasan por una visita. */
  webLeads: number;
  paidLeads: number;
  hot: number;
  converted: number;
  visits: number;
  impressions: number;
  clicks: number;
  /** Todo el gasto imputado (incluye IA en los totales). */
  spend: number;
  /** Gasto en publicidad (base de CPC y CPM). */
  adSpend: number;
}

export interface Rates {
  costPerLead?: number;
  /** Costo de adquisición de cliente: gasto / clientes nuevos (leads convertidos). */
  cac?: number;
  /** Clientes / leads. */
  conversionRate?: number;
  /** Leads del sitio / visitas. */
  visitToLeadRate?: number;
  /** Clics / visualizaciones. */
  ctr?: number;
  /** Gasto en publicidad / clics. */
  cpc?: number;
  /** Gasto en publicidad por cada mil visualizaciones. */
  cpm?: number;
}

export type PerformanceRow = Counts & Rates & { key: string; label: string };

export interface FunnelStep {
  key: "impressions" | "clicks" | "visits" | "leads" | "interested" | "customers";
  label: string;
  value: number;
  /** Conversión desde el paso anterior (0–1). */
  rateFromPrevious?: number;
}

export interface SeriesPoint {
  /** Inicio del tramo, `YYYY-MM-DD`. */
  start: string;
  label: string;
  leads: number;
  converted: number;
  visits: number;
  spend: number;
}

export interface MarketingReport {
  totals: Counts & Rates & { aiSpend: number; interested: number };
  funnel: FunnelStep[];
  series: { granularity: "day" | "week"; points: SeriesPoint[] };
  spendByCategory: Array<{ category: ExpenseCategory | "ai_assistant"; amount: number }>;
  byChannel: PerformanceRow[];
  byCampaign: PerformanceRow[];
  ai: { costUsd: number; replies: number; conversations: number; spend: number; costPerConversation?: number };
}

const emptyCounts = (): Counts => ({ leads: 0, webLeads: 0, paidLeads: 0, hot: 0, converted: 0, visits: 0, impressions: 0, clicks: 0, spend: 0, adSpend: 0 });
const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : undefined;
const spendRatio = (spend: number, denominator: number) => spend > 0 && denominator > 0 ? spend / denominator : undefined;

export function rates(counts: Counts): Rates {
  return {
    costPerLead: spendRatio(counts.spend, counts.leads),
    cac: spendRatio(counts.spend, counts.converted),
    conversionRate: ratio(counts.converted, counts.leads),
    visitToLeadRate: ratio(counts.webLeads, counts.visits),
    ctr: ratio(counts.clicks, counts.impressions),
    cpc: spendRatio(counts.adSpend, counts.clicks),
    cpm: counts.adSpend > 0 && counts.impressions > 0 ? (counts.adSpend / counts.impressions) * 1000 : undefined,
  };
}

function countLead(counts: Counts, lead: ReportLead, paid: boolean) {
  counts.leads += 1;
  if (lead.source === "web") counts.webLeads += 1;
  if (paid) counts.paidLeads += 1;
  if (lead.status === "converted") counts.converted += 1;
  else if (leadTemperature(lead) === "hot") counts.hot += 1;
}

function addExpense(counts: Counts, occurrence: ExpenseOccurrence) {
  counts.spend += occurrence.amount;
  if (occurrence.expense.category === "advertising") counts.adSpend += occurrence.amount;
  counts.impressions += occurrence.expense.impressions ?? 0;
  counts.clicks += occurrence.expense.clicks ?? 0;
}

const dayMs = 86_400_000;
const parseDay = (date: string) => Date.parse(`${date}T00:00:00Z`);
const formatDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const shortLabel = (date: string) => `${Number(date.slice(8, 10))}/${Number(date.slice(5, 7))}`;

/** Tramos del gráfico: diarios hasta 31 días, semanales (lunes) para rangos más largos. */
export function seriesBuckets(range: { from: string; to: string }) {
  const days = Math.round((parseDay(range.to) - parseDay(range.from)) / dayMs) + 1;
  const granularity: "day" | "week" = days <= 31 ? "day" : "week";
  const starts: string[] = [];
  if (granularity === "day") {
    for (let ms = parseDay(range.from); ms <= parseDay(range.to); ms += dayMs) starts.push(formatDay(ms));
  } else {
    starts.push(range.from);
    const first = parseDay(range.from);
    const weekday = (new Date(first).getUTCDay() + 6) % 7; // lunes = 0
    for (let ms = first + (7 - weekday) * dayMs; ms <= parseDay(range.to); ms += 7 * dayMs) starts.push(formatDay(ms));
  }
  /** Índice del tramo de una fecha local `YYYY-MM-DD` (o -1 si queda fuera). */
  const indexOf = (date: string) => {
    if (date < range.from || date > range.to) return -1;
    let index = 0;
    while (index + 1 < starts.length && starts[index + 1] <= date) index += 1;
    return index;
  };
  return { granularity, starts, indexOf };
}

/**
 * Rendimiento comercial del período: visualizaciones, clics, visitas, leads y clientes por
 * procedencia y campaña, cruzados con el gasto registrado y el consumo de IA.
 * Montos en la moneda del reporte (`aiToReport` convierte el costo de IA desde USD).
 * `localDate` convierte un instante ISO a la fecha local del negocio (`YYYY-MM-DD`).
 */
export function buildMarketingReport(input: {
  range: { from: string; to: string };
  leads: ReportLead[];
  expenses: ExpenseOccurrence[];
  visits: ReportVisit[];
  aiEvents: AiUsageEvent[];
  aiToReport: (usd: number) => number;
  localDate: (iso: string) => string;
}): MarketingReport {
  const channels = new Map<LeadChannel, PerformanceRow>();
  const campaigns = new Map<string, PerformanceRow>();
  const channelRow = (key: LeadChannel) => channels.get(key) ?? channels.set(key, { key, label: leadChannels[key].label, ...emptyCounts() }).get(key)!;
  const campaignRow = (key: string) => campaigns.get(key) ?? campaigns.set(key, { key, label: key, ...emptyCounts() }).get(key)!;
  const totals = emptyCounts();
  const buckets = seriesBuckets(input.range);
  const points: SeriesPoint[] = buckets.starts.map((start) => ({ start, label: shortLabel(start), leads: 0, converted: 0, visits: 0, spend: 0 }));
  const point = (date: string) => points[buckets.indexOf(date)] as SeriesPoint | undefined;

  for (const lead of input.leads) {
    const origin = leadOrigin(lead);
    countLead(totals, lead, origin.paid);
    countLead(channelRow(origin.channel), lead, origin.paid);
    if (origin.campaign) countLead(campaignRow(origin.campaign), lead, origin.paid);
    const bucket = point(input.localDate(lead.createdAt));
    if (bucket) { bucket.leads += 1; if (lead.status === "converted") bucket.converted += 1; }
  }

  for (const visit of input.visits) {
    const origin = leadOrigin({ source: "web", attribution: visit.attribution });
    totals.visits += 1;
    channelRow(origin.channel).visits += 1;
    if (origin.campaign) campaignRow(origin.campaign).visits += 1;
    const bucket = point(input.localDate(visit.visitedAt));
    if (bucket) bucket.visits += 1;
  }

  const byCategory = new Map<ExpenseCategory, number>();
  for (const occurrence of input.expenses) {
    const { expense, amount } = occurrence;
    addExpense(totals, occurrence);
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + amount);
    if (expense.channel) addExpense(channelRow(expense.channel), occurrence);
    const campaign = normalizeCampaign(expense.campaign);
    if (campaign) addExpense(campaignRow(campaign), occurrence);
    const bucket = point(occurrence.date);
    if (bucket) bucket.spend += amount;
  }

  let aiUsd = 0;
  const conversations = new Set<string>();
  for (const event of input.aiEvents) {
    aiUsd += event.costUsd;
    if (event.conversationId) conversations.add(event.conversationId);
    const bucket = point(input.localDate(event.createdAt));
    if (bucket) bucket.spend += input.aiToReport(event.costUsd);
  }
  const aiSpend = input.aiToReport(aiUsd);
  totals.spend += aiSpend;

  const interested = totals.hot + totals.converted;
  const funnel: FunnelStep[] = [];
  const pushStep = (step: Omit<FunnelStep, "rateFromPrevious">, rateFromPrevious?: number) => funnel.push({ ...step, rateFromPrevious: funnel.length ? rateFromPrevious : undefined });
  if (totals.impressions > 0) pushStep({ key: "impressions", label: "Visualizaciones", value: totals.impressions });
  if (totals.clicks > 0) pushStep({ key: "clicks", label: "Clics en anuncios", value: totals.clicks }, ratio(totals.clicks, totals.impressions));
  if (totals.visits > 0) pushStep({ key: "visits", label: "Visitas al sitio", value: totals.visits }, ratio(totals.visits, totals.clicks));
  // Desde visitas se mide con los leads del sitio: los de WhatsApp o referidos no pasan por una visita.
  pushStep({ key: "leads", label: "Leads", value: totals.leads }, totals.visits > 0 ? ratio(totals.webLeads, totals.visits) : ratio(totals.leads, totals.clicks));
  pushStep({ key: "interested", label: "Interesados (calientes o clientes)", value: interested }, ratio(interested, totals.leads));
  pushStep({ key: "customers", label: "Clientes", value: totals.converted }, ratio(totals.converted, interested));

  const sortRows = (rows: Iterable<PerformanceRow>) => [...rows]
    .map((row) => ({ ...row, ...rates(row) }))
    .sort((a, b) => b.leads - a.leads || b.visits - a.visits || b.spend - a.spend || a.label.localeCompare(b.label));

  return {
    totals: { ...totals, ...rates(totals), aiSpend, interested },
    funnel,
    series: { granularity: buckets.granularity, points },
    spendByCategory: [
      ...(aiSpend > 0 ? [{ category: "ai_assistant" as const, amount: aiSpend }] : []),
      ...expenseCategoryKeys.filter((key) => byCategory.has(key)).map((category) => ({ category, amount: byCategory.get(category)! })),
    ].sort((a, b) => b.amount - a.amount),
    byChannel: sortRows(channels.values()),
    byCampaign: sortRows(campaigns.values()),
    ai: { costUsd: aiUsd, replies: input.aiEvents.length, conversations: conversations.size, spend: aiSpend, costPerConversation: spendRatio(aiSpend, conversations.size) },
  };
}

/** Rango de fechas del reporte (`YYYY-MM-DD`, inclusive) a partir de la URL; por defecto, el mes en curso. */
export const reportPresets = {
  month: "Este mes",
  previous_month: "Mes anterior",
  last_30: "Últimos 30 días",
  last_90: "Últimos 90 días",
  year: "Este año",
} as const;
export type ReportPreset = keyof typeof reportPresets;

const ymd = (date: Date) => date.toISOString().slice(0, 10);
const isYmd = (value: string | undefined): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));

export function resolveReportRange(params: { preset?: string; from?: string; to?: string }, today: string): { preset?: ReportPreset; from: string; to: string } {
  if (isYmd(params.from) && isYmd(params.to) && params.from <= params.to && parseDay(params.to) - parseDay(params.from) <= 366 * dayMs) return { from: params.from, to: params.to };
  const preset = (params.preset && params.preset in reportPresets ? params.preset : "month") as ReportPreset;
  const [year, month] = today.split("-").map(Number);
  const now = new Date(`${today}T00:00:00Z`);
  const daysAgo = (days: number) => ymd(new Date(now.getTime() - days * dayMs));
  switch (preset) {
    case "previous_month":
      return { preset, from: ymd(new Date(Date.UTC(year, month - 2, 1))), to: ymd(new Date(Date.UTC(year, month - 1, 0))) };
    case "last_30":
      return { preset, from: daysAgo(29), to: today };
    case "last_90":
      return { preset, from: daysAgo(89), to: today };
    case "year":
      return { preset, from: `${year}-01-01`, to: today };
    default:
      return { preset, from: ymd(new Date(Date.UTC(year, month - 1, 1))), to: today };
  }
}
