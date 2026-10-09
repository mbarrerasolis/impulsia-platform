import { describe, expect, it } from "vitest";
import { expenseInputSchema, expenseOccurrences, type MarketingExpense } from "./expenses";
import { leadOrigin } from "./lead-channel";
import { buildMarketingReport, resolveReportRange, seriesBuckets, type ReportLead } from "./performance";

const lead = (overrides: Partial<ReportLead>): ReportLead => ({ id: crypto.randomUUID(), source: "web", status: "new", score: 40, createdAt: "2026-10-05T12:00:00Z", ...overrides });
const expense = (overrides: Partial<MarketingExpense>): MarketingExpense => ({ id: crypto.randomUUID(), spentOn: "2026-10-01", category: "advertising", description: "Anuncios", amount: 10_000, currency: "CLP", recurrence: "once", createdAt: "2026-10-01T00:00:00Z", ...overrides });
const same = (amount: number) => amount;

describe("leadOrigin", () => {
  it("etiqueta Instagram pagado desde UTM y normaliza la campaña", () => {
    expect(leadOrigin({ source: "web", attribution: { utmSource: "ig", utmMedium: "paid_social", utmCampaign: "Lanzamiento Octubre" } }))
      .toEqual({ channel: "instagram", paid: true, campaign: "lanzamiento-octubre", label: "Instagram · Pagado" });
  });
  it("usa el referrer y marca orgánico sin medio de pago", () => {
    expect(leadOrigin({ source: "web", attribution: { referrer: "l.facebook.com" } }).label).toBe("Facebook · Orgánico");
  });
  it("un clic de anuncio sin UTM queda como Meta", () => {
    expect(leadOrigin({ source: "web", attribution: { fbclid: "abc" } }).channel).toBe("meta");
  });
  it("sin atribución usa el canal donde se creó el lead", () => {
    expect(leadOrigin({ source: "whatsapp" })).toMatchObject({ channel: "whatsapp", paid: false, label: "WhatsApp" });
    expect(leadOrigin({ source: "web" }).label).toBe("Web directa");
    expect(leadOrigin({ source: "outbound" }).channel).toBe("other");
  });
  it("una fuente UTM desconocida cae en Otro", () => {
    expect(leadOrigin({ source: "web", attribution: { utmSource: "volante" } }).channel).toBe("other");
  });
});

describe("expenseOccurrences", () => {
  it("repite los gastos mensuales dentro del período y respeta el término", () => {
    const monthly = expense({ spentOn: "2026-08-31", recurrence: "monthly", endsOn: "2026-11-15" });
    const dates = expenseOccurrences([monthly], { from: "2026-09-01", to: "2026-12-31" }, same).map((item) => item.date);
    expect(dates).toEqual(["2026-09-30", "2026-10-31"]);
  });
  it("incluye un gasto único sólo si cae en el período y convierte la moneda", () => {
    const usd = expense({ amount: 20, currency: "USD", spentOn: "2026-10-10" });
    const result = expenseOccurrences([usd, expense({ spentOn: "2026-09-30" })], { from: "2026-10-01", to: "2026-10-31" }, (amount, currency) => currency === "USD" ? amount * 950 : amount);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(19_000);
  });
});

describe("buildMarketingReport", () => {
  const range = { from: "2026-10-01", to: "2026-10-31" };
  const localDate = (iso: string) => iso.slice(0, 10);
  const build = (input: Partial<Parameters<typeof buildMarketingReport>[0]>) => buildMarketingReport({ range, leads: [], expenses: [], visits: [], aiEvents: [], aiToReport: (usd) => usd * 950, localDate, ...input });

  it("cruza visitas, leads y gastos por procedencia y campaña, con CAC y métricas de anuncios", () => {
    const instagramAd = { utmSource: "instagram", utmMedium: "cpc", utmCampaign: "otono" };
    const leads = [
      lead({ attribution: instagramAd, status: "converted" }),
      lead({ attribution: instagramAd, score: 80 }),
      lead({ source: "whatsapp", createdAt: "2026-10-06T12:00:00Z" }),
    ];
    const visits = Array.from({ length: 20 }, (_, index) => ({ visitedAt: `2026-10-0${1 + (index % 5)}T15:00:00Z`, attribution: index < 16 ? instagramAd : undefined }));
    const expenses = expenseOccurrences([
      expense({ channel: "instagram", campaign: "Otoño", amount: 40_000, impressions: 10_000, clicks: 200 }),
      expense({ category: "tools", amount: 10_000 }),
    ], range, same);
    const report = build({ leads, visits, expenses, aiEvents: [{ createdAt: "2026-10-02T10:00:00Z", costUsd: 1, conversationId: "c1" }] });

    expect(report.totals).toMatchObject({ spend: 50_950, adSpend: 40_000, leads: 3, webLeads: 2, paidLeads: 2, hot: 1, converted: 1, visits: 20, impressions: 10_000, clicks: 200, interested: 2 });
    expect(report.totals.cac).toBe(50_950);
    expect(report.totals.ctr).toBeCloseTo(0.02);
    expect(report.totals.cpc).toBe(200);
    expect(report.totals.cpm).toBe(4_000);
    expect(report.totals.visitToLeadRate).toBeCloseTo(0.1);

    const instagram = report.byChannel.find((row) => row.key === "instagram")!;
    expect(instagram).toMatchObject({ visits: 16, leads: 2, spend: 40_000, costPerLead: 20_000, cac: 40_000, conversionRate: 0.5, visitToLeadRate: 0.125 });
    expect(report.byChannel.find((row) => row.key === "web")).toMatchObject({ visits: 4, leads: 0 });
    expect(report.byChannel.find((row) => row.key === "whatsapp")?.costPerLead).toBeUndefined();
    expect(report.byCampaign).toHaveLength(1);
    expect(report.byCampaign[0]).toMatchObject({ key: "otono", visits: 16, leads: 2, converted: 1, spend: 40_000, impressions: 10_000, clicks: 200, cpc: 200, cac: 40_000 });
  });

  it("arma el embudo con la conversión entre pasos", () => {
    const leads = [lead({ status: "converted" }), lead({ score: 80 }), lead({}), lead({ source: "whatsapp" })];
    const visits = Array.from({ length: 30 }, () => ({ visitedAt: "2026-10-03T12:00:00Z" }));
    const expenses = expenseOccurrences([expense({ impressions: 5_000, clicks: 100 })], range, same);
    const funnel = build({ leads, visits, expenses }).funnel;
    expect(funnel.map((step) => [step.key, step.value])).toEqual([["impressions", 5_000], ["clicks", 100], ["visits", 30], ["leads", 4], ["interested", 2], ["customers", 1]]);
    expect(funnel[0].rateFromPrevious).toBeUndefined();
    expect(funnel[1].rateFromPrevious).toBeCloseTo(0.02);
    expect(funnel[3].rateFromPrevious).toBeCloseTo(3 / 30);
    expect(funnel[5].rateFromPrevious).toBe(0.5);
  });

  it("sin anuncios ni visitas el embudo parte en los leads", () => {
    expect(build({ leads: [lead({})] }).funnel.map((step) => step.key)).toEqual(["leads", "interested", "customers"]);
  });

  it("agrupa la serie por día y suma gasto e IA en su fecha", () => {
    const report = build({
      leads: [lead({ createdAt: "2026-10-05T12:00:00Z" })],
      expenses: expenseOccurrences([expense({ spentOn: "2026-10-05", amount: 1_000 })], range, same),
      aiEvents: [{ createdAt: "2026-10-05T23:00:00Z", costUsd: 0.1 }],
    });
    expect(report.series.granularity).toBe("day");
    expect(report.series.points).toHaveLength(31);
    expect(report.series.points[4]).toMatchObject({ start: "2026-10-05", label: "5/10", leads: 1, spend: 1_095 });
  });
});

describe("seriesBuckets", () => {
  it("usa semanas desde el lunes en rangos largos", () => {
    const buckets = seriesBuckets({ from: "2026-07-01", to: "2026-09-30" });
    expect(buckets.granularity).toBe("week");
    expect(buckets.starts.slice(0, 3)).toEqual(["2026-07-01", "2026-07-06", "2026-07-13"]);
    expect(buckets.indexOf("2026-07-05")).toBe(0);
    expect(buckets.indexOf("2026-07-06")).toBe(1);
    expect(buckets.indexOf("2026-10-01")).toBe(-1);
  });
});

describe("resolveReportRange", () => {
  it("por defecto es el mes en curso hasta hoy", () => {
    expect(resolveReportRange({}, "2026-10-15")).toEqual({ preset: "month", from: "2026-10-01", to: "2026-10-15" });
  });
  it("calcula el mes anterior, incluso al cruzar el año", () => {
    expect(resolveReportRange({ preset: "previous_month" }, "2026-01-10")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });
  it("acepta un rango manual válido y descarta uno invertido", () => {
    expect(resolveReportRange({ from: "2026-09-01", to: "2026-09-30" }, "2026-10-15")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolveReportRange({ from: "2026-09-30", to: "2026-09-01" }, "2026-10-15").preset).toBe("month");
  });
});

describe("expenseInputSchema", () => {
  it("normaliza la campaña y rechaza montos inválidos", () => {
    expect(expenseInputSchema.parse({ spentOn: "2026-10-01", category: "advertising", channel: "", campaign: " Otoño 2026 ", description: "Meta Ads", amount: "15000" }))
      .toMatchObject({ channel: undefined, campaign: "otono-2026", amount: 15_000, currency: "CLP", recurrence: "once" });
    expect(() => expenseInputSchema.parse({ spentOn: "2026-10-01", category: "advertising", description: "x", amount: 0 })).toThrow();
  });
});
