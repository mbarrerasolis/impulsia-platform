import { z } from "zod";
import type { AccountSummary, Contact } from "@/domain/crm/entities";
import type { BillingPeriodRecord, ClientSolutionRecord, ImplementationTaskRecord, QuoteRecord } from "@/domain/operations/entities";
import { pricingRulesSchema, thirdPartyCostItemsSchema } from "@/domain/pricing/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDashboardSnapshotFromMetrics } from "@/domain/analytics/dashboard";
import { createPageResult, normalizePageRequest } from "@/lib/pagination";
import type { InternalProfileSummary, PortalSolutionSummary, ReadModelRepository } from "@/repositories/read-model-repository";

const contactRoleSchema = z.enum(["commercial", "billing", "technical", "administrative", "management"]);
const quoteStatusSchema = z.enum(["draft", "approved", "rejected"]);
const complexitySchema = z.enum(["standard", "medium", "high", "research", "advanced_research"]);
const clientSolutionStatusSchema = z.enum(["approved", "development", "testing", "production", "paused", "cancelled"]);
const taskStatusSchema = z.enum(["pending", "in_progress", "done", "blocked"]);
const billingPricingSnapshotSchema: z.ZodType<BillingPeriodRecord["pricingSnapshot"]> = z.object({
  subscriptionItemIds: z.array(z.string()),
  generatedAt: z.string(),
});

export class SupabaseReadModelRepository implements ReadModelRepository {
  async listAccounts(): Promise<AccountSummary[]> {
    const client = await createSupabaseServerClient();
    const [accountsResult, contactsResult, solutionsResult, subscriptionsResult, itemsResult] = await Promise.all([
      client.from("accounts").select("id,legal_name,trade_name,status,industry"),
      client.from("contacts").select("account_id"),
      client.from("client_solutions").select("account_id,status"),
      client.from("subscriptions").select("id,account_id,status"),
      client.from("subscription_items").select("subscription_id,net_amount,starts_at,ends_at"),
    ]);
    const error = accountsResult.error ?? contactsResult.error ?? solutionsResult.error ?? subscriptionsResult.error ?? itemsResult.error;
    if (error) throw new Error(`No fue posible cargar cuentas: ${error.message}`);

    const activeSubscriptionAccount = new Map(
      (subscriptionsResult.data ?? [])
        .filter((row) => row.status === "active")
        .map((row) => [row.id, row.account_id]),
    );
    const today = new Date().toISOString().slice(0, 10);
    const mrr = new Map<string, number>();

    for (const item of itemsResult.data ?? []) {
      const accountId = activeSubscriptionAccount.get(item.subscription_id);
      if (accountId && item.starts_at <= today && (!item.ends_at || item.ends_at >= today)) {
        mrr.set(accountId, (mrr.get(accountId) ?? 0) + Number(item.net_amount));
      }
    }

    return (accountsResult.data ?? []).map((row) => ({
      id: row.id,
      legalName: row.legal_name,
      tradeName: row.trade_name,
      status: row.status,
      industry: row.industry ?? "Sin industria",
      contactCount: (contactsResult.data ?? []).filter((contact) => contact.account_id === row.id).length,
      activeSolutions: (solutionsResult.data ?? []).filter(
        (solution) => solution.account_id === row.id && solution.status !== "cancelled",
      ).length,
      mrr: mrr.get(row.id) ?? 0,
    }));
  }

  async listAccountsPage(input = {}) {
    const { page, pageSize, from, search } = normalizePageRequest(input);
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("list_account_summaries_page", {
      p_offset: from,
      p_limit: pageSize,
      p_search: search ?? null,
    });
    if (error) throw new Error(`No fue posible cargar cuentas: ${error.message}`);
    const rows = data ?? [];
    return createPageResult(
      rows.map((row) => ({
        id: row.id,
        legalName: row.legal_name,
        tradeName: row.trade_name,
        status: row.status,
        industry: row.industry,
        contactCount: Number(row.contact_count),
        activeSolutions: Number(row.active_solutions),
        mrr: Number(row.mrr),
      })),
      Number(rows[0]?.total_count ?? 0),
      page,
      pageSize,
    );
  }

  async findAccount(id: string) {
    return (await this.listAccounts()).find((item) => item.id === id);
  }

  async listContacts(accountId: string): Promise<Contact[]> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("contacts")
      .select("id,account_id,first_name,last_name,email,phone,job_title,is_active,is_primary_billing,contact_roles(role)")
      .eq("account_id", accountId)
      .order("last_name");
    if (error) throw new Error(`No fue posible cargar contactos: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone ?? undefined,
      jobTitle: row.job_title ?? "Sin cargo",
      roles: (row.contact_roles ?? []).map((item) => contactRoleSchema.parse(item.role)),
      isActive: row.is_active,
      isPrimaryBilling: row.is_primary_billing,
    }));
  }

  async findQuote(id: string): Promise<QuoteRecord | undefined> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("quotes").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`No fue posible cargar la cotización: ${error.message}`);
    if (!data) return undefined;

    return {
      id: data.id,
      accountId: data.account_id,
      name: data.name,
      status: quoteStatusSchema.parse(data.status),
      estimatedDays: Number(data.estimated_days),
      dayRate: Number(data.day_rate_snapshot),
      complexity: complexitySchema.parse(data.complexity),
      complexityFactor: Number(data.complexity_factor),
      grossImplementation: Number(data.gross_implementation_price),
      activeSolutionsAfterAddition: Number(data.active_solutions_after_addition),
      expansionDiscountPercent: Number(data.expansion_discount_percent),
      netImplementation: Number(data.net_implementation_price),
      grossMaintenanceIncrement: Number(data.gross_maintenance_increment),
      maintenanceDiscountPercent: Number(data.maintenance_discount_percent),
      netMaintenanceIncrement: Number(data.net_maintenance_increment),
      thirdPartyCosts: thirdPartyCostItemsSchema.parse(data.third_party_costs ?? []),
      pricingRuleVersion: data.pricing_rule_version,
      pricingSnapshot: pricingRulesSchema.parse(data.pricing_snapshot),
      estimationNotes: data.estimation_notes ?? undefined,
      createdAt: data.created_at,
      approvedAt: data.approved_at ?? undefined,
    };
  }

  async listSolutions(): Promise<ClientSolutionRecord[]> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("client_solutions").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(`No fue posible cargar soluciones: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      quoteId: row.quote_id ?? "",
      name: row.name,
      status: clientSolutionStatusSchema.parse(row.status),
      estimatedDays: Number(row.estimated_days),
      complexityFactor: Number(row.complexity_factor),
      dayRateSnapshot: Number(row.day_rate_snapshot),
      grossImplementationPrice: Number(row.gross_implementation_price),
      expansionDiscountPercent: Number(row.expansion_discount_percent),
      netImplementationPrice: Number(row.net_implementation_price),
      grossMaintenanceIncrement: Number(row.gross_maintenance_increment),
      maintenanceDiscountPercent: Number(row.maintenance_discount_percent),
      netMaintenanceIncrement: Number(row.net_maintenance_increment),
      pricingSnapshot: pricingRulesSchema.parse(row.pricing_snapshot),
      createdAt: row.created_at,
    }));
  }

  async listSolutionsPage(input = {}) {
    const { page, pageSize, from } = normalizePageRequest(input);
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("list_solution_summaries_page", { p_offset: from, p_limit: pageSize });
    if (error) throw new Error(`No fue posible cargar soluciones: ${error.message}`);
    const rows = data ?? [];
    return createPageResult(
      rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        accountName: row.account_name,
        name: row.name,
        status: clientSolutionStatusSchema.parse(row.status),
        estimatedDays: Number(row.estimated_days),
        netImplementationPrice: Number(row.net_implementation_price),
        netMaintenanceIncrement: Number(row.net_maintenance_increment),
        pricingVersion: row.pricing_version,
        createdAt: row.created_at,
      })),
      Number(rows[0]?.total_count ?? 0),
      page,
      pageSize,
    );
  }

  async listPortalSolutions(): Promise<PortalSolutionSummary[]> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("list_portal_solutions");
    if (error) throw new Error(`No fue posible cargar las soluciones del portal: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      status: clientSolutionStatusSchema.parse(row.status),
      estimatedDays: Number(row.estimated_days),
    }));
  }

  async listBillingPeriods(): Promise<BillingPeriodRecord[]> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("billing_periods")
      .select("*,subscriptions!inner(account_id)")
      .order("due_date", { ascending: false });
    if (error) throw new Error(`No fue posible cargar períodos: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      subscriptionId: row.subscription_id,
      accountId: row.subscriptions.account_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      dueDate: row.due_date,
      amountDue: Number(row.amount_due),
      amountPaid: Number(row.amount_paid),
      status: row.status,
      pricingSnapshot: billingPricingSnapshotSchema.parse(row.pricing_snapshot),
    }));
  }

  async listBillingPeriodsPage(input = {}) {
    const { page, pageSize, from } = normalizePageRequest(input);
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("list_billing_period_summaries_page", { p_offset: from, p_limit: pageSize });
    if (error) throw new Error(`No fue posible cargar períodos: ${error.message}`);
    const rows = data ?? [];
    return createPageResult(
      rows.map((row) => ({
        id: row.id,
        accountId: row.account_id,
        accountName: row.account_name,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        dueDate: row.due_date,
        amountDue: Number(row.amount_due),
        amountPaid: Number(row.amount_paid),
        status: row.status,
      })),
      Number(rows[0]?.total_count ?? 0),
      page,
      pageSize,
    );
  }

  async getDashboardReadModel() {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("get_dashboard_metrics");
    if (error) throw new Error(`No fue posible cargar el resumen: ${error.message}`);
    const row = data?.[0];
    if (!row) throw new Error("No fue posible cargar el resumen: respuesta vacía.");
    const billingByMonth = row.billing_by_month && typeof row.billing_by_month === "object" && !Array.isArray(row.billing_by_month)
      ? Object.fromEntries(Object.entries(row.billing_by_month).map(([key, value]) => [key, Number(value)]))
      : {};
    const pipelineCounts = row.pipeline_counts && typeof row.pipeline_counts === "object" && !Array.isArray(row.pipeline_counts)
      ? Object.fromEntries(Object.entries(row.pipeline_counts).map(([key, value]) => [key, Number(value)]))
      : {};
    const snapshot = buildDashboardSnapshotFromMetrics({
      currentMrr: Number(row.current_mrr),
      activeClients: Number(row.active_clients),
      expansionMrrThisMonth: Number(row.expansion_mrr_this_month),
      activeImplementations: Number(row.active_implementations),
      receivableAmount: Number(row.receivable_amount),
      overdueAmount: Number(row.overdue_amount),
      overduePeriods: Number(row.overdue_periods),
      blockedTasks: Number(row.blocked_tasks),
      overdueTasks: Number(row.overdue_tasks),
      newLeads: Number(row.new_leads),
      soldSolutionsThisMonth: Number(row.sold_solutions_this_month),
      billingByMonth,
      pipelineCounts,
    });
    const accountTotal = Number(row.account_total);
    const leadTotal = Number(row.lead_total);
    return {
      snapshot,
      accountTotal,
      leadTotal,
      hasOperation: Boolean(accountTotal || leadTotal || snapshot.soldSolutionsThisMonth || snapshot.billingMonths.some((month) => month.amount > 0)),
    };
  }

  async listTasks(clientSolutionId: string): Promise<ImplementationTaskRecord[]> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("implementation_tasks")
      .select("id,client_solution_id,title,status,assignee,estimate_hours,actual_hours,due_date,created_at,profiles(display_name)")
      .eq("client_solution_id", clientSolutionId)
      .order("created_at");
    if (error) throw new Error(`No fue posible cargar las tareas: ${error.message}`);

    return (data ?? []).map((row) => ({
      id: row.id,
      clientSolutionId: row.client_solution_id,
      title: row.title,
      status: taskStatusSchema.parse(row.status),
      assignee: row.assignee ?? undefined,
      assigneeName: row.profiles?.display_name ?? undefined,
      estimateHours: row.estimate_hours == null ? undefined : Number(row.estimate_hours),
      actualHours: row.actual_hours == null ? undefined : Number(row.actual_hours),
      dueDate: row.due_date ?? undefined,
      createdAt: row.created_at,
    }));
  }

  async listInternalProfiles(): Promise<InternalProfileSummary[]> {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("profiles").select("id,display_name").is("account_id", null).order("display_name");
    if (error) throw new Error(`No fue posible cargar el equipo interno: ${error.message}`);
    return (data ?? []).map((row) => ({ id: row.id, displayName: row.display_name }));
  }
}
