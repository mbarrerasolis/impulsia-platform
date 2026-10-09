import { describe, expect, it } from "vitest";
import { adExpensesFromMetaInsights, metaSyncRange } from "./meta-ads";
import { syncMetaAdSpend } from "@/services/marketing/sync-meta-ads";

const row = {
  campaign_id: "120210000", campaign_name: "Lanzamiento Oct", date_start: "2026-10-06",
  spend: "6980.4", impressions: "4200", clicks: "61", account_currency: "CLP", publisher_platform: "instagram",
};

describe("adExpensesFromMetaInsights", () => {
  it("convierte el gasto diario por campaña y ubicación en un gasto de publicidad", () => {
    expect(adExpensesFromMetaInsights([row])).toEqual([{
      externalRef: "meta:120210000:2026-10-06:instagram",
      spentOn: "2026-10-06",
      channel: "instagram",
      campaign: "lanzamiento-oct",
      description: "Meta Ads · Lanzamiento Oct · Instagram",
      amount: 6980,
      currency: "CLP",
      impressions: 4200,
      clicks: 61,
    }]);
  });

  it("usa Facebook o Meta según la ubicación y omite días sin gasto, monedas ajenas y filas inválidas", () => {
    const result = adExpensesFromMetaInsights([
      { ...row, publisher_platform: "facebook" },
      { ...row, publisher_platform: "audience_network" },
      { ...row, spend: "0" },
      { ...row, account_currency: "EUR" },
      { campaign_name: "sin id" },
    ]);
    expect(result.map((expense) => expense.channel)).toEqual(["facebook", "meta"]);
  });

  it("nunca deja más clics que visualizaciones", () => {
    expect(adExpensesFromMetaInsights([{ ...row, impressions: "10", clicks: "12" }])[0].clicks).toBe(10);
  });
});

describe("metaSyncRange", () => {
  it("cuenta los días en la hora de Chile", () => {
    expect(metaSyncRange(new Date("2026-10-08T02:00:00Z"), 7)).toEqual({ since: "2026-10-01", until: "2026-10-07" });
  });
});

describe("syncMetaAdSpend", () => {
  it("pide el rango a Meta y guarda los gastos como importados", async () => {
    const saved: unknown[] = [];
    const result = await syncMetaAdSpend({
      repository: { upsertSyncedExpenses: async (source, expenses) => { saved.push(source, expenses.length); return expenses.length; } },
      fetchInsights: async (range) => (range.since === "2026-10-01" ? [row, { ...row, spend: "0" }] : []),
      days: 7,
      now: new Date("2026-10-08T02:00:00Z"),
    });
    expect(result).toEqual({ since: "2026-10-01", until: "2026-10-07", rows: 2, saved: 1 });
    expect(saved).toEqual(["meta_ads", 1]);
  });
});
