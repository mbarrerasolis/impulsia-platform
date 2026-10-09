import { z } from "zod";
import { leadSources } from "@/domain/crm/entities";
import { expenseCategoryKeys, expenseCurrencies, type ExpenseInput, type ExpenseSource, type MarketingExpense } from "@/domain/marketing/expenses";
import type { SyncedAdExpense } from "@/domain/marketing/meta-ads";
import { leadChannelKeys } from "@/domain/marketing/lead-channel";
import { parseLeadAttribution } from "@/domain/marketing/attribution";
import type { AiUsageEvent, ReportLead, ReportVisit } from "@/domain/marketing/performance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { MarketingRepository, ReportWindow, VisitInput } from "../marketing-repository";

const pageSize = 1000;
const expenseRow = z.object({
  category: z.enum(expenseCategoryKeys as [string, ...string[]]),
  channel: z.enum(leadChannelKeys as [string, ...string[]]).nullable(),
  currency: z.enum(expenseCurrencies),
  recurrence: z.enum(["once", "monthly"]),
});
const leadSourceSchema = z.enum(leadSources);
const leadStatusSchema = z.enum(["new", "contacted", "qualified", "converted", "lost"]);

function mapExpense(row: Tables<"marketing_expenses">): MarketingExpense {
  const parsed = expenseRow.parse(row);
  return {
    id: row.id,
    spentOn: row.spent_on,
    category: parsed.category as MarketingExpense["category"],
    channel: (parsed.channel ?? undefined) as MarketingExpense["channel"],
    campaign: row.campaign ?? undefined,
    description: row.description,
    amount: Number(row.amount),
    currency: parsed.currency,
    recurrence: parsed.recurrence,
    endsOn: row.ends_on ?? undefined,
    impressions: row.impressions ?? undefined,
    clicks: row.clicks ?? undefined,
    source: row.source === "meta_ads" ? "meta_ads" : "manual",
    createdAt: row.created_at,
  };
}

/** Lee todas las filas de una consulta en páginas (PostgREST corta en 1.000 por defecto). */
async function readAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, label: string) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(`No fue posible leer ${label}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

export class SupabaseMarketingRepository implements MarketingRepository {
  async listExpenses(window: ReportWindow) {
    const client = await createSupabaseServerClient();
    const rows = await readAll((from, to) => client.from("marketing_expenses").select("*")
      .lte("spent_on", window.to)
      .or(`and(recurrence.eq.once,spent_on.gte.${window.from}),and(recurrence.eq.monthly,or(ends_on.is.null,ends_on.gte.${window.from}))`)
      .order("spent_on", { ascending: false }).order("id").range(from, to), "los gastos");
    return rows.map(mapExpense);
  }

  async createExpense(input: ExpenseInput, createdBy?: string) {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("marketing_expenses").insert({
      spent_on: input.spentOn,
      category: input.category,
      channel: input.channel ?? null,
      campaign: input.campaign ?? null,
      description: input.description,
      amount: input.amount,
      currency: input.currency,
      recurrence: input.recurrence,
      ends_on: input.recurrence === "monthly" ? input.endsOn ?? null : null,
      impressions: input.recurrence === "once" ? input.impressions ?? null : null,
      clicks: input.recurrence === "once" ? input.clicks ?? null : null,
      created_by: createdBy && createdBy !== "demo-owner" ? createdBy : null,
    }).select("*").single();
    if (error) throw new Error(`No fue posible registrar el gasto: ${error.message}`);
    return mapExpense(data);
  }

  async deleteExpense(id: string) {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("marketing_expenses").delete().eq("id", id).select("id");
    if (error) throw new Error(`No fue posible eliminar el gasto: ${error.message}`);
    if (!data?.length) throw new Error("Gasto no encontrado.");
  }

  /** Lo usa la sincronización programada (sin sesión de usuario), por eso con la clave de servicio. */
  async upsertSyncedExpenses(source: ExpenseSource, expenses: SyncedAdExpense[]) {
    if (!expenses.length) return 0;
    const client = createSupabaseAdminClient();
    const { data, error } = await client.from("marketing_expenses").upsert(expenses.map((expense) => ({
      spent_on: expense.spentOn,
      category: "advertising",
      channel: expense.channel,
      campaign: expense.campaign ?? null,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      recurrence: "once",
      ends_on: null,
      impressions: expense.impressions ?? null,
      clicks: expense.clicks ?? null,
      source,
      external_ref: expense.externalRef,
    })), { onConflict: "external_ref" }).select("id");
    if (error) throw new Error(`No fue posible guardar los gastos sincronizados: ${error.message}`);
    return data?.length ?? 0;
  }

  async listLeads(window: ReportWindow): Promise<ReportLead[]> {
    const client = await createSupabaseServerClient();
    const rows = await readAll((from, to) => client.from("leads").select("id,source,status,score,attribution,created_at")
      .gte("created_at", window.startsAt).lt("created_at", window.endsBefore)
      .order("created_at").order("id").range(from, to), "los leads");
    return rows.map((row) => ({
      id: row.id,
      source: leadSourceSchema.parse(row.source),
      status: leadStatusSchema.parse(row.status),
      score: row.score,
      attribution: parseLeadAttribution(row.attribution),
      createdAt: row.created_at,
    }));
  }

  async listAiUsage(window: ReportWindow): Promise<AiUsageEvent[]> {
    const client = await createSupabaseServerClient();
    const rows = await readAll((from, to) => client.from("ai_usage_events").select("id,cost_usd,conversation_id,created_at")
      .gte("created_at", window.startsAt).lt("created_at", window.endsBefore)
      .order("created_at").order("id").range(from, to), "el consumo de IA");
    return rows.map((row) => ({ createdAt: row.created_at, costUsd: Number(row.cost_usd), conversationId: row.conversation_id ?? undefined }));
  }

  async listVisits(window: ReportWindow): Promise<ReportVisit[]> {
    const client = await createSupabaseServerClient();
    const rows = await readAll((from, to) => client.from("site_visits").select("id,visited_at,utm_source,utm_medium,utm_campaign,referrer,fbclid")
      .gte("visited_at", window.startsAt).lt("visited_at", window.endsBefore)
      .order("visited_at").order("id").range(from, to), "las visitas");
    return rows.map((row) => ({
      visitedAt: row.visited_at,
      attribution: parseLeadAttribution({
        utmSource: row.utm_source ?? undefined,
        utmMedium: row.utm_medium ?? undefined,
        utmCampaign: row.utm_campaign ?? undefined,
        referrer: row.referrer ?? undefined,
        // Sólo se guarda si hubo clic de anuncio, no el identificador.
        fbclid: row.fbclid ? "anuncio" : undefined,
      }),
    }));
  }

  async recordVisit(input: VisitInput) {
    // El sitio público es anónimo: inserta el servidor con la clave elevada, sin datos personales.
    const { error } = await createSupabaseAdminClient().from("site_visits").upsert({
      session_id: input.sessionId,
      utm_source: input.attribution?.utmSource ?? null,
      utm_medium: input.attribution?.utmMedium ?? null,
      utm_campaign: input.attribution?.utmCampaign ?? null,
      referrer: input.attribution?.referrer ?? null,
      fbclid: Boolean(input.attribution?.fbclid),
      landing_path: input.landingPath ?? null,
    }, { onConflict: "session_id", ignoreDuplicates: true });
    if (error) throw new Error(`No fue posible registrar la visita: ${error.message}`);
  }
}
