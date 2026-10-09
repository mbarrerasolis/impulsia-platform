import { billingSchema, saleCustomerSchema, saleErrors, type PaymentMethod, type PaymentStatus, type QuoteVersion, type Sale, type SaleActor, type SaleLine, type SalePayment, type SaleStatus } from "@/domain/storefront/sales";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables, TablesUpdate } from "@/lib/supabase/database.types";
import { openSaleStatuses, phoneDigits, type NewPayment, type NewQuoteVersion, type NewSale, type NewSaleEvent, type SaleListFilter, type SalePatch, type SaleRepository } from "../sale-repository";

const saleSelect = "*, store_quote_versions(*), store_payments(*), store_sale_events(*)";

type SaleRow = Tables<"store_sales"> & {
  store_quote_versions: Tables<"store_quote_versions">[];
  store_payments: Tables<"store_payments">[];
  store_sale_events: Tables<"store_sale_events">[];
};

const byCreated = <T extends { created_at: string }>(a: T, b: T) => a.created_at.localeCompare(b.created_at);
const optional = <T>(value: T | null) => value ?? undefined;

function mapVersion(row: Tables<"store_quote_versions">): QuoteVersion {
  return {
    version: row.version,
    createdAt: row.created_at,
    lines: row.lines as unknown as SaleLine[],
    totals: { products: row.products_total, net: row.net, vat: row.vat, ...(row.shipping !== null ? { shipping: row.shipping } : {}), total: row.total },
    validUntil: row.valid_until,
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.changes ? { changes: row.changes } : {}),
    createdVia: row.created_via as SaleActor,
  };
}

function mapPayment(row: Tables<"store_payments">): SalePayment {
  return {
    id: row.id,
    createdAt: row.created_at,
    method: row.method as PaymentMethod,
    amount: row.amount,
    expectedAmount: row.expected_amount,
    quoteVersion: row.quote_version,
    status: row.status as PaymentStatus,
    payer: optional(row.payer),
    paidOn: optional(row.paid_on),
    receiptRef: optional(row.receipt_ref),
    note: optional(row.note),
    reviewedAt: optional(row.reviewed_at),
    reviewNote: optional(row.review_note),
  };
}

/** Al leer no se rechaza: un dato antiguo fuera de formato se muestra tal cual. */
function readCustomer(value: Json): Sale["customer"] {
  const parsed = saleCustomerSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const raw = (value ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" ? raw[key] as string : "");
  return { name: text("name") || "Sin nombre", kind: raw.kind === "negocio" ? "negocio" : "persona", company: text("company"), taxId: text("taxId"), phone: text("phone"), email: text("email") };
}

function mapSale(row: SaleRow): Sale {
  const billing = row.billing ? billingSchema.safeParse(row.billing) : undefined;
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    number: row.number,
    orderNumber: optional(row.order_number),
    status: row.status as SaleStatus,
    leadId: optional(row.lead_id),
    conversationId: optional(row.conversation_id),
    customer: readCustomer(row.customer),
    destination: row.destination,
    deliveryMode: row.delivery_mode as Sale["deliveryMode"],
    carrier: optional(row.carrier),
    paymentMethod: optional(row.payment_method) as PaymentMethod | undefined,
    document: optional(row.document) as Sale["document"],
    billing: billing?.success ? billing.data : undefined,
    tracking: optional(row.tracking),
    notes: optional(row.notes),
    currentVersion: row.current_version,
    versions: [...row.store_quote_versions].sort((a, b) => a.version - b.version).map(mapVersion),
    payments: [...row.store_payments].sort(byCreated).map(mapPayment),
    events: [...row.store_sale_events].sort(byCreated).map((event) => ({
      id: event.id,
      createdAt: event.created_at,
      ...(event.from_status ? { from: event.from_status as SaleStatus } : {}),
      to: event.to_status as SaleStatus,
      via: event.via as SaleActor,
      ...(event.note ? { note: event.note } : {}),
    })),
  };
}

const eventRow = (saleId: string, event: NewSaleEvent) => ({
  sale_id: saleId,
  from_status: event.from ?? null,
  to_status: event.to,
  via: event.via,
  note: event.note ?? null,
  actor: event.actorId ?? null,
});

const versionRow = (saleId: string, version: NewQuoteVersion) => ({
  sale_id: saleId,
  version: version.version,
  lines: version.lines as unknown as Json,
  products_total: version.totals.products,
  net: version.totals.net,
  vat: version.totals.vat,
  shipping: version.totals.shipping ?? null,
  total: version.totals.total,
  valid_until: version.validUntil,
  notes: version.notes ?? null,
  changes: version.changes ?? null,
  created_via: version.createdVia,
  created_by: version.createdBy ?? null,
});

function fail(action: string, error: { message: string }): never {
  throw new Error(`No fue posible ${action}: ${error.message}`);
}

/**
 * Ventas en Supabase. Las escribe el servidor con la clave de servicio (el asistente no tiene sesión y
 * las rutas del panel validan el rol antes); el equipo las lee también bajo RLS.
 */
export class SupabaseSaleRepository implements SaleRepository {
  private get client() {
    return createSupabaseAdminClient();
  }

  async nextNumber(prefix: "COT" | "PED", year: number) {
    const { data, error } = await this.client.rpc("next_store_sale_number", { p_prefix: prefix, p_year: year });
    if (error) fail("generar el número", error);
    return data;
  }

  async create(sale: NewSale, version: NewQuoteVersion, event: NewSaleEvent) {
    const { data, error } = await this.client.from("store_sales").insert({
      number: sale.number,
      status: sale.status,
      lead_id: sale.leadId ?? null,
      conversation_id: sale.conversationId ?? null,
      customer: sale.customer as unknown as Json,
      destination: sale.destination,
      delivery_mode: sale.deliveryMode,
      notes: sale.notes ?? null,
      current_version: version.version,
    }).select("id").single();
    if (error) fail("crear la cotización", error);
    const { error: versionError } = await this.client.from("store_quote_versions").insert(versionRow(data.id, version));
    if (versionError) {
      await this.client.from("store_sales").delete().eq("id", data.id);
      fail("guardar la cotización", versionError);
    }
    await this.client.from("store_sale_events").insert(eventRow(data.id, event));
    return (await this.get(data.id))!;
  }

  private async one(column: "id" | "number" | "order_number", value: string) {
    const { data, error } = await this.client.from("store_sales").select(saleSelect).eq(column, value).maybeSingle();
    if (error) fail("leer la venta", error);
    return data ? mapSale(data as SaleRow) : undefined;
  }

  async get(id: string) {
    return this.one("id", id);
  }

  async findByNumber(number: string) {
    return number.startsWith("PED-") ? this.one("order_number", number) : this.one("number", number);
  }

  async findOpenByConversation(conversationId: string) {
    const { data, error } = await this.client.from("store_sales").select(saleSelect)
      .eq("conversation_id", conversationId).in("status", [...openSaleStatuses])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) fail("leer la venta", error);
    return data ? mapSale(data as SaleRow) : undefined;
  }

  async list({ statuses, query, limit }: SaleListFilter) {
    let request = this.client.from("store_sales").select(saleSelect).order("updated_at", { ascending: false }).limit(limit);
    if (statuses) request = request.in("status", [...statuses]);
    const text = query?.trim().replace(/[%,()]/g, " ");
    const digits = phoneDigits(query);
    // El teléfono se guarda normalizado (+569…): se busca por sus dígitos, escritos como sea.
    if (digits) request = request.ilike("customer->>phone", `%${digits}%`);
    else if (text) {
      const like = `%${text}%`;
      request = request.or(`number.ilike.${like},order_number.ilike.${like},customer->>name.ilike.${like},customer->>company.ilike.${like}`);
    }
    const { data, error } = await request;
    if (error) fail("leer las ventas", error);
    return (data as SaleRow[]).map(mapSale);
  }

  async addVersion(saleId: string, version: NewQuoteVersion, status: SaleStatus, event: NewSaleEvent) {
    const { error } = await this.client.from("store_quote_versions").insert(versionRow(saleId, version));
    if (error) fail("guardar la nueva versión", error);
    const { error: updateError } = await this.client.from("store_sales").update({ current_version: version.version, status }).eq("id", saleId);
    if (updateError) fail("actualizar la venta", updateError);
    await this.client.from("store_sale_events").insert(eventRow(saleId, event));
  }

  async update(saleId: string, patch: SalePatch, event?: NewSaleEvent) {
    const row: TablesUpdate<"store_sales"> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.orderNumber !== undefined) row.order_number = patch.orderNumber;
    if (patch.customer !== undefined) row.customer = patch.customer as unknown as Json;
    if (patch.destination !== undefined) row.destination = patch.destination;
    if (patch.deliveryMode !== undefined) row.delivery_mode = patch.deliveryMode;
    if (patch.carrier !== undefined) row.carrier = patch.carrier;
    if (patch.paymentMethod !== undefined) row.payment_method = patch.paymentMethod;
    if (patch.document !== undefined) row.document = patch.document;
    if (patch.billing !== undefined) row.billing = patch.billing as unknown as Json;
    if (patch.tracking !== undefined) row.tracking = patch.tracking;
    if (patch.notes !== undefined) row.notes = patch.notes;
    const { data, error } = await this.client.from("store_sales").update(row).eq("id", saleId).select("id");
    if (error) fail("actualizar la venta", error);
    if (!data.length) throw new Error(saleErrors.notFound);
    if (event) await this.client.from("store_sale_events").insert(eventRow(saleId, event));
  }

  async addPayment(saleId: string, payment: NewPayment) {
    const { data, error } = await this.client.from("store_payments").insert({
      sale_id: saleId,
      quote_version: payment.quoteVersion,
      method: payment.method,
      amount: payment.amount,
      expected_amount: payment.expectedAmount,
      payer: payment.payer ?? null,
      paid_on: payment.paidOn ?? null,
      receipt_ref: payment.receiptRef ?? null,
      note: payment.note ?? null,
    }).select("*").single();
    if (error) fail("registrar el pago", error);
    return mapPayment(data);
  }

  async reviewPayment(paymentId: string, status: "approved" | "rejected", note: string | undefined, reviewerId?: string) {
    const { data, error } = await this.client.from("store_payments")
      .update({ status, review_note: note ?? null, reviewed_at: new Date().toISOString(), reviewed_by: reviewerId ?? null })
      .eq("id", paymentId).eq("status", "in_review").select("id");
    if (error) fail("revisar el pago", error);
    if (!data.length) throw new Error(saleErrors.paymentReviewed);
  }
}
