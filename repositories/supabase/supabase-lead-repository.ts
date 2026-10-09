import { storeOrderGoals } from "@/domain/storefront/order-lead";
import { z } from "zod";
import type { Lead } from "@/domain/crm/entities";
import { parseLeadAttribution } from "@/domain/marketing/attribution";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPageResult, normalizePageRequest } from "@/lib/pagination";
import type { Tables } from "@/lib/supabase/database.types";
import { closedLeadStatuses, temperatureBands, type LeadTemperatureView } from "@/domain/crm/lead-temperature";
import { leadOrigins, type LeadFilters } from "@/domain/crm/lead-filters";
import type { LeadListRequest, LeadRepository } from "../lead-repository";

const leadSourceSchema = z.enum(["web", "instagram", "whatsapp", "email", "referral", "outbound", "other"]);
const apiKnowledgeSchema = z.enum(["yes", "no", "unknown"]);
const leadStatusSchema = z.enum(["new", "contacted", "qualified", "converted", "lost"]);
const closedStatusList = `(${closedLeadStatuses.join(",")})`;

/** Filtro por temperatura sobre cualquier consulta de leads (la temperatura se deriva del score y el estado). */
function whereTemperature<Q extends { in(column: string, values: string[]): Q; not(column: string, operator: string, value: string): Q; gte(column: string, value: number): Q; lt(column: string, value: number): Q }>(query: Q, temperature?: LeadTemperatureView): Q {
  if (!temperature) return query;
  if (temperature === "closed") return query.in("status", closedLeadStatuses);
  const open = query.not("status", "in", closedStatusList);
  if (temperature === "hot") return open.gte("score", temperatureBands.hotFrom);
  if (temperature === "warm") return open.gte("score", temperatureBands.warmFrom).lt("score", temperatureBands.hotFrom);
  return open.lt("score", temperatureBands.warmFrom);
}

/** Filtros del CRM; `search` ya viene saneado (`sanitizeSearch`) para no romper la sintaxis de `or`. */
function whereFilters<Q extends { eq(column: string, value: string): Q; or(filters: string): Q; is(column: string, value: null): Q }>(query: Q, filters: LeadFilters): Q {
  let result = query;
  if (filters.source) result = result.eq("source", filters.source);
  if (filters.status) result = result.eq("status", filters.status);
  if (filters.origin === "none") result = result.is("attribution", null);
  else if (filters.origin) {
    const origin = leadOrigins[filters.origin];
    result = result.or([
      `attribution->>utmSource.in.(${origin.utmSources.join(",")})`,
      `attribution->>referrer.in.(${origin.referrers.join(",")})`,
    ].join(","));
  }
  if (filters.search) {
    const like = `%${filters.search}%`;
    result = result.or(["name", "company", "email", "phone"].map((column) => `${column}.ilike.${like}`).join(","));
  }
  return result;
}

export class SupabaseLeadRepository implements LeadRepository {
  private map(row: Tables<"leads">): Lead {
    return {
      id: row.id,
      source: leadSourceSchema.parse(row.source),
      name: row.name,
      company: row.company,
      email: row.email,
      phone: row.phone ?? undefined,
      rawNeedDescription: row.raw_need_description,
      systems: row.systems,
      apiKnowledge: apiKnowledgeSchema.parse(row.api_knowledge),
      peopleInvolved: row.people_involved ?? undefined,
      hoursPerMonth: row.hours_per_month ?? undefined,
      monthlyVolume: row.monthly_volume ?? undefined,
      primaryGoal: row.primary_goal,
      status: leadStatusSchema.parse(row.status),
      score: row.score,
      consentGiven: row.consent_given,
      convertedAccountId: row.converted_account_id ?? undefined,
      attribution: parseLeadAttribution(row.attribution),
      createdAt: row.created_at,
    };
  }
  async create(input: Omit<Lead, "id" | "createdAt">): Promise<Lead> {
    const client = await createSupabaseServerClient();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const { error } = await client.from("leads").insert({
      id,
      created_at: createdAt,
      source: input.source,
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone || null,
      raw_need_description: input.rawNeedDescription,
      systems: input.systems,
      api_knowledge: input.apiKnowledge,
      people_involved: input.peopleInvolved ?? null,
      hours_per_month: input.hoursPerMonth ?? null,
      monthly_volume: input.monthlyVolume ?? null,
      primary_goal: input.primaryGoal,
      status: input.status,
      score: input.score,
      consent_given: input.consentGiven,
      // Sólo si hay datos: un lead sin origen se guarda igual aunque la migración aún no esté aplicada.
      ...(input.attribution ? { attribution: input.attribution } : {})
    });
    if (error) throw new Error(`No fue posible crear el lead: ${error.message}`);
    return {
      ...input,
      id,
      createdAt,
    };
  }

  async list(): Promise<Lead[]> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("leads").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`No fue posible listar leads: ${error.message}`);
    return (data ?? []).map((row) => this.map(row));
  }
  async listPage(input: LeadListRequest = {}) {
    const { page, pageSize, from, to } = normalizePageRequest(input);
    const client = await createSupabaseServerClient();
    let query = whereFilters(whereTemperature(client
      .from("leads")
      .select("id,source,name,company,email,phone,primary_goal,status,score,attribution,created_at", { count: "exact" }), input.temperature), input);
    if (input.sort !== "recent") query = query.order("score", { ascending: false });
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw new Error(`No fue posible listar leads: ${error.message}`);
    return createPageResult(
      (data ?? []).map((row) => ({
        id: row.id,
        source: leadSourceSchema.parse(row.source),
        name: row.name,
        company: row.company,
        email: row.email,
        phone: row.phone ?? undefined,
        primaryGoal: row.primary_goal,
        status: leadStatusSchema.parse(row.status),
        score: row.score,
        attribution: parseLeadAttribution(row.attribution),
        createdAt: row.created_at,
      })),
      count ?? 0,
      page,
      pageSize,
    );
  }
  async countByTemperature(filters: LeadFilters = {}) {
    const client = await createSupabaseServerClient();
    const views: LeadTemperatureView[] = ["hot", "warm", "cold", "closed"];
    const counts = await Promise.all(views.map(async (view) => {
      const { count, error } = await whereFilters(whereTemperature(client.from("leads").select("id", { count: "exact", head: true }), view), filters);
      if (error) throw new Error(`No fue posible contar leads: ${error.message}`);
      return [view, count ?? 0] as const;
    }));
    return Object.fromEntries(counts) as Record<LeadTemperatureView, number>;
  }
  async updateScore(id: string, score: number) {
    const client = await createSupabaseServerClient();
    const { error } = await client.from("leads").update({ score }).eq("id", id);
    if (error) throw new Error(`No fue posible actualizar el lead: ${error.message}`);
  }
  async countWebLeadsSince(since: string, email?: string) {
    // Lo usa el formulario público (anónimo), que por RLS no puede leer leads: por eso el cliente elevado.
    // Sin `head`: una petición HEAD fallida no trae cuerpo y el error llega sin mensaje.
    let query = createSupabaseAdminClient().from("leads").select("id", { count: "exact" }).eq("source", "web").gte("created_at", since).limit(1);
    if (email) query = query.eq("email", email);
    const { count, error, status } = await query;
    if (error) throw new Error(`No fue posible contar leads recientes (HTTP ${status}, ${error.code ?? "sin código"}): ${error.message} ${error.hint ?? ""}`.trim());
    return count ?? 0;
  }
  async countStoreOrdersSince(since: string) {
    const client = await createSupabaseServerClient();
    const { count, error } = await client.from("leads").select("id", { count: "exact", head: true }).in("primary_goal", [...storeOrderGoals]).gte("created_at", since);
    if (error) throw new Error(`No fue posible contar pedidos: ${error.message}`);
    return count ?? 0;
  }
  async find(id:string){const client=await createSupabaseServerClient();const {data,error}=await client.from("leads").select("*").eq("id",id).maybeSingle();if(error)throw new Error(`No fue posible leer el lead: ${error.message}`);return data?this.map(data):undefined;}
}
