import { z } from "zod";
import { invalidPhoneMessage, normalizePhone } from "@/domain/crm/phone";

/**
 * Ventas de la tienda (fase B): una venta nace como cotización COT-AAAA-NNNNN, cada cambio crea una
 * versión nueva (V1, V2…) que no se edita, y al elegir la forma de pago pasa a ser el pedido
 * PED-AAAA-NNNNN. Estados según el manual del vendedor (los 1–3, contacto y calificación, viven en el
 * lead del CRM). Sólo una persona del equipo aprueba un pago: el asistente nunca marca una venta pagada.
 */

export const saleStatuses = [
  "quote_draft",
  "quote_sent",
  "quote_revised",
  "quote_accepted",
  "payment_pending",
  "payment_in_review",
  "paid",
  "preparing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type SaleStatus = (typeof saleStatuses)[number];

export const saleStatusLabels: Record<SaleStatus, string> = {
  quote_draft: "Cotización en preparación",
  quote_sent: "Cotización enviada",
  quote_revised: "Cotización modificada",
  quote_accepted: "Cotización aceptada",
  payment_pending: "Pago pendiente",
  payment_in_review: "Pago en revisión",
  paid: "Pagada",
  preparing: "En preparación",
  ready_to_ship: "Lista para despacho",
  shipped: "Despachada",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

/** Código del manual del cliente para cada estado (lo que el asistente nombra). */
export const saleStatusCodes: Record<SaleStatus, string> = {
  quote_draft: "COTIZACIÓN_EN_PREPARACIÓN",
  quote_sent: "COTIZACIÓN_ENVIADA",
  quote_revised: "COTIZACIÓN_MODIFICADA",
  quote_accepted: "COTIZACIÓN_ACEPTADA",
  payment_pending: "PAGO_PENDIENTE",
  payment_in_review: "VENTA_REGISTRADA_PAGO_EN_REVISIÓN",
  paid: "VENTA_CONFIRMADA_PAGADA",
  preparing: "PEDIDO_EN_PREPARACIÓN",
  ready_to_ship: "PEDIDO_LISTO_PARA_DESPACHO",
  shipped: "PEDIDO_DESPACHADO",
  delivered: "PEDIDO_ENTREGADO",
  cancelled: "VENTA_CANCELADA",
};

/** Grupos de la bandeja del panel. */
export const saleStages = {
  cotizaciones: ["quote_draft", "quote_sent", "quote_revised", "quote_accepted"],
  pagos: ["payment_pending", "payment_in_review"],
  despacho: ["paid", "preparing", "ready_to_ship", "shipped"],
  cerradas: ["delivered", "cancelled"],
} as const satisfies Record<string, readonly SaleStatus[]>;
export type SaleStage = keyof typeof saleStages;
export const saleStageLabels: Record<SaleStage, string> = {
  cotizaciones: "Cotizaciones",
  pagos: "Pagos por revisar",
  despacho: "Por despachar",
  cerradas: "Cerradas",
};

/** Quién hace el cambio: el asistente sólo puede lo que el manual le permite. */
export type SaleActor = "assistant" | "panel";

/** Estados en que la cotización aún se puede modificar (crea versión nueva y pide aceptarla de nuevo). */
export const revisableStatuses: readonly SaleStatus[] = ["quote_draft", "quote_sent", "quote_revised", "quote_accepted", "payment_pending"];

const transitions: Record<SaleStatus, readonly SaleStatus[]> = {
  quote_draft: ["quote_sent", "cancelled"],
  quote_sent: ["quote_accepted", "cancelled"],
  quote_revised: ["quote_sent", "quote_accepted", "cancelled"],
  quote_accepted: ["payment_pending", "cancelled"],
  payment_pending: ["payment_in_review", "paid", "cancelled"],
  payment_in_review: ["paid", "payment_pending", "cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["ready_to_ship", "cancelled"],
  ready_to_ship: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** Lo que el asistente puede hacer por su cuenta; aprobar pagos, despachar y cancelar es del equipo. */
const assistantTargets: readonly SaleStatus[] = ["quote_sent", "quote_accepted", "payment_pending", "payment_in_review"];

export function canTransition(from: SaleStatus, to: SaleStatus, actor: SaleActor) {
  if (!transitions[from].includes(to)) return false;
  return actor === "panel" || assistantTargets.includes(to);
}

export function nextStatuses(from: SaleStatus, actor: SaleActor) {
  return transitions[from].filter((to) => canTransition(from, to, actor));
}

export const saleErrors = {
  notFound: "Venta no encontrada.",
  transition: (from: SaleStatus, to: SaleStatus) => `La venta está "${saleStatusLabels[from]}" y no admite pasar a "${saleStatusLabels[to]}".`,
  notRevisable: (status: SaleStatus) => `La venta está "${saleStatusLabels[status]}": ya no admite cambios en la cotización. Deriva a una persona del equipo.`,
  empty: "La cotización no tiene productos válidos.",
  unpriced: "Hay productos sin precio publicado; no se puede emitir la cotización. Deriva a una persona del equipo.",
  incomplete: (missing: string[]) => `Faltan datos para crear el pedido: ${missing.join(", ")}.`,
  paymentNotFound: "Pago no encontrado.",
  paymentReviewed: "Ese pago ya fue revisado.",
};

export function formatSaleNumber(prefix: "COT" | "PED", year: number, sequence: number) {
  return `${prefix}-${year}-${String(sequence).padStart(5, "0")}`;
}

/** COT-2026-00128-V2: número de la cotización con su versión. */
export function quoteReference(number: string, version: number) {
  return `${number}-V${version}`;
}

/** Acepta "COT-2026-128", "cot 2026 00128 v2" o "PED-2026-00004"; devuelve el número normalizado y la versión si venía. */
export function parseSaleReference(text: string) {
  const match = /\b(COT|PED)[\s-]*(\d{4})[\s-]*(\d{1,6})(?:[\s-]*V(\d{1,3}))?\b/i.exec(text.trim());
  if (!match) return undefined;
  const prefix = match[1].toUpperCase() as "COT" | "PED";
  return { prefix, number: formatSaleNumber(prefix, Number(match[2]), Number(match[3])), ...(match[4] ? { version: Number(match[4]) } : {}) };
}

export interface SaleLine {
  /** "<producto>::<presentación>" del catálogo. */
  id: string;
  name: string;
  format?: string;
  sku?: string;
  quantity: number;
  /** Precio unitario con IVA. */
  unitPrice: number;
}

export interface QuoteTotals {
  /** Suma de productos con IVA. */
  products: number;
  net: number;
  vat: number;
  /** Transporte con IVA; `undefined` = por confirmar. */
  shipping?: number;
  /** Productos + transporte (si ya está cotizado). */
  total: number;
}

/** Montos de una cotización: los precios de la tienda ya incluyen IVA, así que neto e IVA se desglosan. */
export function quoteTotals(lines: Pick<SaleLine, "quantity" | "unitPrice">[], taxRate: number, shipping?: number): QuoteTotals {
  const products = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const net = Math.round(products / (1 + taxRate));
  return { products, net, vat: products - net, ...(shipping !== undefined ? { shipping } : {}), total: products + (shipping ?? 0) };
}

export const defaultQuoteValidityDays = 3;

export function quoteValidUntil(issuedAt: Date, days = defaultQuoteValidityDays) {
  return new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export const customerKinds = ["persona", "negocio"] as const;
export const deliveryModes = ["despacho", "retiro", "por_definir"] as const;
export type DeliveryMode = (typeof deliveryModes)[number];
export const deliveryModeLabels: Record<DeliveryMode, string> = { despacho: "Despacho", retiro: "Retiro", por_definir: "Por definir" };
export const paymentMethods = ["transfer", "gateway"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export const paymentMethodLabels: Record<PaymentMethod, string> = { transfer: "Transferencia", gateway: "Pago en la página" };
export const documentKinds = ["boleta", "factura"] as const;

export const saleCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(customerKinds),
  company: z.string().trim().max(140).default(""),
  taxId: z.string().trim().max(20).default(""),
  /** Se guarda normalizado (+56912345678) para que el enlace de WhatsApp y la búsqueda funcionen. */
  phone: z.string().trim().max(30).default("").transform((value, context) => {
    if (!value) return "";
    const normalized = normalizePhone(value);
    if (!normalized) context.addIssue({ code: "custom", message: invalidPhoneMessage });
    return normalized ?? value;
  }),
  email: z.union([z.literal(""), z.email()]).default(""),
});
export type SaleCustomer = z.infer<typeof saleCustomerSchema>;

export const billingSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  taxId: z.string().trim().min(3).max(20),
  activity: z.string().trim().min(2).max(160),
  address: z.string().trim().min(3).max(200),
  commune: z.string().trim().min(2).max(80),
  email: z.email(),
  phone: z.string().trim().max(30).default(""),
  purchaseOrder: z.string().trim().max(60).default(""),
});
export type BillingData = z.infer<typeof billingSchema>;

export interface QuoteVersion {
  version: number;
  createdAt: string;
  lines: SaleLine[];
  totals: QuoteTotals;
  validUntil: string;
  notes?: string;
  /** Qué cambió respecto de la versión anterior. */
  changes?: string;
  createdVia: SaleActor;
}

export const paymentStatuses = ["in_review", "approved", "rejected"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];
export const paymentStatusLabels: Record<PaymentStatus, string> = { in_review: "En revisión", approved: "Aprobado", rejected: "Rechazado" };

export interface SalePayment {
  id: string;
  createdAt: string;
  method: PaymentMethod;
  /** Monto que declara el comprobante (o la pasarela). */
  amount: number;
  /** Total de la versión vigente al registrarlo, para ver si coincide. */
  expectedAmount: number;
  quoteVersion: number;
  status: PaymentStatus;
  payer?: string;
  paidOn?: string;
  /** Referencia al comprobante (mensaje de WhatsApp, archivo) o al pago de la pasarela. */
  receiptRef?: string;
  note?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface SaleEvent {
  id: string;
  createdAt: string;
  from?: SaleStatus;
  to: SaleStatus;
  via: SaleActor;
  note?: string;
}

export interface Sale {
  id: string;
  createdAt: string;
  updatedAt: string;
  number: string;
  orderNumber?: string;
  status: SaleStatus;
  leadId?: string;
  conversationId?: string;
  customer: SaleCustomer;
  destination: string;
  deliveryMode: DeliveryMode;
  carrier?: string;
  paymentMethod?: PaymentMethod;
  document?: (typeof documentKinds)[number];
  billing?: BillingData;
  tracking?: string;
  notes?: string;
  currentVersion: number;
  versions: QuoteVersion[];
  payments: SalePayment[];
  events: SaleEvent[];
}

export function currentQuote(sale: Pick<Sale, "versions" | "currentVersion">) {
  return sale.versions.find((version) => version.version === sale.currentVersion) ?? sale.versions.at(-1);
}

/** Qué falta para que una cotización aceptada se convierta en pedido (manual, sección 15). */
export function missingForOrder(sale: Pick<Sale, "customer" | "destination" | "deliveryMode" | "paymentMethod" | "document" | "billing" | "versions" | "currentVersion">) {
  const missing: string[] = [];
  const quote = currentQuote(sale);
  if (!quote?.lines.length) missing.push("productos");
  if (!sale.customer.phone && !sale.customer.email) missing.push("teléfono o email del cliente");
  if (!sale.destination.trim()) missing.push("destino");
  if (sale.deliveryMode === "por_definir") missing.push("modalidad de entrega (despacho o retiro)");
  if (sale.deliveryMode === "despacho" && quote?.totals.shipping === undefined) missing.push("costo de transporte");
  if (!sale.paymentMethod) missing.push("forma de pago");
  if (!sale.document) missing.push("boleta o factura");
  if (sale.document === "factura" && !sale.billing) missing.push("datos de facturación");
  return missing;
}

/** Resumen de cambios entre dos versiones (para registrar y para el cliente). */
export function describeChanges(previous: Pick<QuoteVersion, "lines" | "totals">, next: Pick<QuoteVersion, "lines" | "totals">, money: (amount: number) => string) {
  const before = new Map(previous.lines.map((line) => [line.id, line]));
  const after = new Map(next.lines.map((line) => [line.id, line]));
  const label = (line: SaleLine) => `${line.name}${line.format ? ` ${line.format}` : ""}`;
  const changes: string[] = [];
  for (const line of next.lines) {
    const old = before.get(line.id);
    if (!old) changes.push(`agrega ${line.quantity} × ${label(line)}`);
    else if (old.quantity !== line.quantity) changes.push(`${label(line)}: ${old.quantity} → ${line.quantity}`);
    else if (old.unitPrice !== line.unitPrice) changes.push(`${label(line)}: precio ${money(old.unitPrice)} → ${money(line.unitPrice)}`);
  }
  for (const line of previous.lines) if (!after.has(line.id)) changes.push(`quita ${label(line)}`);
  if (previous.totals.shipping !== next.totals.shipping) {
    changes.push(`transporte: ${previous.totals.shipping === undefined ? "por confirmar" : money(previous.totals.shipping)} → ${next.totals.shipping === undefined ? "por confirmar" : money(next.totals.shipping)}`);
  }
  return changes.join("; ");
}

/** Texto de la cotización para el cliente y el equipo (sección 8 del manual). */
export function quoteText(sale: Pick<Sale, "number" | "customer" | "destination" | "deliveryMode" | "paymentMethod">, quote: QuoteVersion, money: (amount: number) => string, formatDate: (iso: string) => string) {
  const { totals } = quote;
  return [
    `Cotización ${quoteReference(sale.number, quote.version)} — ${formatDate(quote.createdAt)}`,
    `Cliente: ${sale.customer.name}${sale.customer.kind === "negocio" && sale.customer.company ? ` · ${sale.customer.company}` : ""}${sale.customer.taxId ? ` · RUT ${sale.customer.taxId}` : ""}`,
    ...quote.lines.map((line) => `• ${line.quantity} × ${line.name}${line.format ? ` (${line.format})` : ""} — ${money(line.unitPrice)} c/u = ${money(line.unitPrice * line.quantity)}`),
    `Neto: ${money(totals.net)} · IVA: ${money(totals.vat)} · Productos: ${money(totals.products)}`,
    `Transporte: ${totals.shipping === undefined ? "por confirmar" : money(totals.shipping)}`,
    `Total: ${money(totals.total)}${totals.shipping === undefined ? " (sin transporte)" : ""}`,
    `Destino: ${sale.destination} · Entrega: ${deliveryModeLabels[sale.deliveryMode]}${sale.paymentMethod ? ` · Pago: ${paymentMethodLabels[sale.paymentMethod]}` : ""}`,
    `Vigencia: hasta ${formatDate(quote.validUntil)}`,
    ...(quote.notes ? [`Observaciones: ${quote.notes}`] : []),
  ].join("\n");
}
