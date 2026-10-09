import type { Storefront } from "@/domain/config/storefront";
import { quoteOrder, type OrderItemRequest } from "@/domain/storefront/assistant-catalog";
import {
  canTransition, saleCustomerSchema, currentQuote, describeChanges, missingForOrder, quoteTotals, quoteValidUntil, revisableStatuses, saleErrors,
  type BillingData, type DeliveryMode, type PaymentMethod, type Sale, type SaleActor, type SaleCustomer, type SaleLine, type SaleStatus,
} from "@/domain/storefront/sales";
import type { NewQuoteVersion, SaleRepository } from "@/repositories/sale-repository";

/**
 * Reglas de las ventas de la tienda (manual del vendedor, secciones 8 a 15). El precio siempre se
 * recalcula aquí con el catálogo vigente; quien llama (asistente o panel) sólo dice qué y cuánto.
 */
export interface SalesDeps {
  repository: SaleRepository;
  /** Catálogo con precios y stock al día. */
  storefront: Pick<Storefront, "products" | "pricing">;
  money: (amount: number) => string;
  now?: () => Date;
  /** Descuenta stock al confirmar el pago; devuelve avisos (sin stock suficiente, etc.). */
  discountStock?: (lines: SaleLine[], reference: string) => Promise<string[]>;
}

export class SaleRuleError extends Error {}

const nowOf = (deps: SalesDeps) => deps.now?.() ?? new Date();

/** Valida y normaliza al cliente (teléfono en +56…), venga del panel o del asistente. */
function checkCustomer(customer: SaleCustomer): SaleCustomer {
  const parsed = saleCustomerSchema.safeParse(customer);
  if (!parsed.success) throw new SaleRuleError(parsed.error.issues[0]?.message ?? "Revisa los datos del cliente.");
  return parsed.data;
}

function buildLines(deps: SalesDeps, items: OrderItemRequest[]) {
  const quote = quoteOrder(deps.storefront, items);
  if (!quote.lines.length) throw new SaleRuleError(quote.problems.length ? `${saleErrors.empty} ${quote.problems.join(" ")}` : saleErrors.empty);
  if (quote.lines.some((line) => !line.price)) throw new SaleRuleError(saleErrors.unpriced);
  const lines: SaleLine[] = quote.lines.map((line) => ({
    id: line.id,
    name: line.name,
    ...(line.format ? { format: line.format } : {}),
    ...(line.sku ? { sku: line.sku } : {}),
    quantity: line.quantity,
    unitPrice: line.price!,
  }));
  return { lines, problems: quote.problems };
}

/** Las líneas de una versión como pedido de catálogo, para recotizarlas con precios vigentes. */
export function linesToItems(lines: SaleLine[]): OrderItemRequest[] {
  return lines.map((line) => {
    const [clave, presentacion = ""] = line.id.split("::");
    return { clave, presentacion, cantidad: line.quantity };
  });
}

async function load(deps: SalesDeps, saleId: string) {
  const sale = await deps.repository.get(saleId);
  if (!sale) throw new SaleRuleError(saleErrors.notFound);
  return sale;
}

function assertTransition(sale: Sale, to: SaleStatus, via: SaleActor) {
  if (!canTransition(sale.status, to, via)) throw new SaleRuleError(saleErrors.transition(sale.status, to));
}

export interface CreateQuoteInput {
  customer: SaleCustomer;
  destination: string;
  deliveryMode: DeliveryMode;
  items: OrderItemRequest[];
  /** Transporte con IVA; sin valor = por confirmar. */
  shipping?: number;
  notes?: string;
  leadId?: string;
  conversationId?: string;
  via: SaleActor;
  actorId?: string;
}

/** Crea la cotización V1. El asistente la entrega al tiro (enviada); en el panel queda en preparación. */
export async function createQuote(deps: SalesDeps, input: CreateQuoteInput) {
  const issuedAt = nowOf(deps);
  const { lines, problems } = buildLines(deps, input.items);
  const number = await deps.repository.nextNumber("COT", issuedAt.getFullYear());
  const status: SaleStatus = input.via === "assistant" ? "quote_sent" : "quote_draft";
  const version: NewQuoteVersion = {
    version: 1,
    lines,
    totals: quoteTotals(lines, deps.storefront.pricing.taxRate, input.shipping),
    validUntil: quoteValidUntil(issuedAt),
    ...(input.notes ? { notes: input.notes } : {}),
    createdVia: input.via,
    ...(input.actorId ? { createdBy: input.actorId } : {}),
  };
  const sale = await deps.repository.create({
    number,
    status,
    ...(input.leadId ? { leadId: input.leadId } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    customer: checkCustomer(input.customer),
    destination: input.destination,
    deliveryMode: input.deliveryMode,
  }, version, { to: status, via: input.via, actorId: input.actorId });
  return { sale, problems };
}

export interface ReviseQuoteInput {
  /** Productos nuevos; sin valor = los mismos, recotizados con precios vigentes. */
  items?: OrderItemRequest[];
  /** Transporte: número, `null` = por confirmar, sin valor = el mismo. */
  shipping?: number | null;
  notes?: string;
  via: SaleActor;
  actorId?: string;
}

/** Versión nueva de la cotización: mismo número, versión +1, pide aceptarla de nuevo (manual, sección 9). */
export async function reviseQuote(deps: SalesDeps, saleId: string, input: ReviseQuoteInput) {
  const sale = await load(deps, saleId);
  if (!revisableStatuses.includes(sale.status)) throw new SaleRuleError(saleErrors.notRevisable(sale.status));
  const previous = currentQuote(sale)!;
  const issuedAt = nowOf(deps);
  const { lines, problems } = buildLines(deps, input.items ?? linesToItems(previous.lines));
  const shipping = input.shipping === null ? undefined : input.shipping ?? previous.totals.shipping;
  const totals = quoteTotals(lines, deps.storefront.pricing.taxRate, shipping);
  const changes = describeChanges(previous, { lines, totals }, deps.money) || "recotizada con precios vigentes";
  const version: NewQuoteVersion = {
    version: Math.max(...sale.versions.map((item) => item.version)) + 1,
    lines,
    totals,
    validUntil: quoteValidUntil(issuedAt),
    ...(input.notes ?? previous.notes ? { notes: input.notes ?? previous.notes } : {}),
    changes,
    createdVia: input.via,
    ...(input.actorId ? { createdBy: input.actorId } : {}),
  };
  await deps.repository.addVersion(sale.id, version, "quote_revised", { from: sale.status, to: "quote_revised", via: input.via, note: changes, actorId: input.actorId });
  return { sale: (await deps.repository.get(sale.id))!, problems, changes };
}

/** El cliente acepta la versión vigente (y no vencida, si lo registra el asistente). */
export async function acceptQuote(deps: SalesDeps, saleId: string, input: { version?: number; via: SaleActor; actorId?: string }) {
  const sale = await load(deps, saleId);
  const quote = currentQuote(sale)!;
  if (input.version !== undefined && input.version !== quote.version) throw new SaleRuleError(`La versión vigente es la V${quote.version}; la V${input.version} fue reemplazada.`);
  if (input.via === "assistant" && new Date(quote.validUntil) < nowOf(deps)) throw new SaleRuleError("La cotización está vencida: modifícala para recotizar con precios vigentes antes de aceptarla.");
  if (sale.status === "quote_draft" && input.via === "panel") {
    await deps.repository.update(sale.id, { status: "quote_sent" }, { from: sale.status, to: "quote_sent", via: "panel", actorId: input.actorId });
    sale.status = "quote_sent";
  }
  assertTransition(sale, "quote_accepted", input.via);
  await deps.repository.update(sale.id, { status: "quote_accepted" }, { from: sale.status, to: "quote_accepted", via: input.via, note: `Acepta V${quote.version}`, actorId: input.actorId });
  return (await deps.repository.get(sale.id))!;
}

export interface PaymentChoiceInput {
  method: PaymentMethod;
  document: "boleta" | "factura";
  billing?: BillingData;
  deliveryMode?: DeliveryMode;
  destination?: string;
  carrier?: string;
  via: SaleActor;
  actorId?: string;
}

/**
 * Elige la forma de pago: con los datos completos la cotización aceptada pasa a pedido PED-AAAA-NNNNN
 * y queda con pago pendiente. Si faltan datos no cambia nada y devuelve qué falta.
 */
export async function choosePayment(deps: SalesDeps, saleId: string, input: PaymentChoiceInput) {
  const sale = await load(deps, saleId);
  if (sale.status !== "payment_pending") assertTransition(sale, "payment_pending", input.via);
  const next: Sale = {
    ...sale,
    paymentMethod: input.method,
    document: input.document,
    ...(input.billing ? { billing: input.billing } : {}),
    ...(input.deliveryMode ? { deliveryMode: input.deliveryMode } : {}),
    ...(input.destination ? { destination: input.destination } : {}),
  };
  const missing = missingForOrder(next);
  if (missing.length) throw new SaleRuleError(saleErrors.incomplete(missing));
  const orderNumber = sale.orderNumber ?? await deps.repository.nextNumber("PED", nowOf(deps).getFullYear());
  await deps.repository.update(sale.id, {
    status: "payment_pending",
    orderNumber,
    paymentMethod: input.method,
    document: input.document,
    ...(input.billing ? { billing: input.billing } : {}),
    ...(input.deliveryMode ? { deliveryMode: input.deliveryMode } : {}),
    ...(input.destination ? { destination: input.destination } : {}),
    ...(input.carrier ? { carrier: input.carrier } : {}),
  }, sale.status === "payment_pending" ? undefined : { from: sale.status, to: "payment_pending", via: input.via, note: `Pedido ${orderNumber}`, actorId: input.actorId });
  return (await deps.repository.get(sale.id))!;
}

export interface TransferInput {
  amount: number;
  payer?: string;
  paidOn?: string;
  receiptRef?: string;
  note?: string;
  via: SaleActor;
  actorId?: string;
}

/**
 * Comprobante de transferencia: la venta queda registrada con el pago en revisión (manual, sección 13).
 * Nunca la marca pagada; si el monto no coincide lo avisa para derivar.
 */
export async function registerTransfer(deps: SalesDeps, saleId: string, input: TransferInput) {
  const sale = await load(deps, saleId);
  if (sale.paymentMethod !== "transfer") throw new SaleRuleError("La venta no tiene la transferencia como forma de pago: regístrala primero.");
  assertTransition(sale, "payment_in_review", input.via);
  const quote = currentQuote(sale)!;
  const payment = await deps.repository.addPayment(sale.id, {
    method: "transfer",
    amount: input.amount,
    expectedAmount: quote.totals.total,
    quoteVersion: quote.version,
    ...(input.payer ? { payer: input.payer } : {}),
    ...(input.paidOn ? { paidOn: input.paidOn } : {}),
    ...(input.receiptRef ? { receiptRef: input.receiptRef } : {}),
    ...(input.note ? { note: input.note } : {}),
  });
  const matches = input.amount === quote.totals.total;
  await deps.repository.update(sale.id, { status: "payment_in_review" }, {
    from: sale.status, to: "payment_in_review", via: input.via, actorId: input.actorId,
    note: matches ? "Comprobante recibido" : `Comprobante por ${deps.money(input.amount)}; el total es ${deps.money(quote.totals.total)}`,
  });
  return { sale: (await deps.repository.get(sale.id))!, payment, matches };
}

/** Sólo el equipo: aprobar marca la venta pagada (y descuenta stock); rechazar la deja con pago pendiente. */
export async function reviewPayment(deps: SalesDeps, saleId: string, input: { paymentId: string; approve: boolean; note?: string; actorId?: string }) {
  const sale = await load(deps, saleId);
  const payment = sale.payments.find((item) => item.id === input.paymentId);
  if (!payment) throw new SaleRuleError(saleErrors.paymentNotFound);
  if (payment.status !== "in_review") throw new SaleRuleError(saleErrors.paymentReviewed);
  const to: SaleStatus = input.approve ? "paid" : "payment_pending";
  assertTransition(sale, to, "panel");
  await deps.repository.reviewPayment(payment.id, input.approve ? "approved" : "rejected", input.note, input.actorId);
  await deps.repository.update(sale.id, { status: to }, { from: sale.status, to, via: "panel", actorId: input.actorId, note: input.note ?? (input.approve ? "Transferencia aprobada" : "Transferencia rechazada") });
  const warnings = input.approve && deps.discountStock ? await deps.discountStock(currentQuote(sale)!.lines, sale.orderNumber ?? sale.number) : [];
  return { sale: (await deps.repository.get(sale.id))!, warnings };
}

/**
 * Avances del panel: enviar la cotización, marcar pagada (p. ej. pasarela o pago en el local),
 * preparar, despachar (con seguimiento), entregar o cancelar. Los pasos con datos propios (aceptar,
 * forma de pago, comprobante) tienen su función.
 */
export async function changeStatus(deps: SalesDeps, saleId: string, input: { to: SaleStatus; note?: string; tracking?: string; via: SaleActor; actorId?: string }) {
  const sale = await load(deps, saleId);
  if (["quote_accepted", "payment_pending", "payment_in_review", "quote_revised"].includes(input.to)) throw new SaleRuleError(saleErrors.transition(sale.status, input.to));
  assertTransition(sale, input.to, input.via);
  if (input.to === "paid" && sale.payments.some((payment) => payment.status === "in_review")) throw new SaleRuleError("Hay un comprobante en revisión: apruébalo o recházalo.");
  if (input.to === "shipped" && sale.deliveryMode === "despacho" && !input.tracking && !sale.tracking) throw new SaleRuleError("Indica el transportista y el número de seguimiento del despacho.");
  await deps.repository.update(sale.id, { status: input.to, ...(input.tracking ? { tracking: input.tracking } : {}) }, { from: sale.status, to: input.to, via: input.via, note: input.note, actorId: input.actorId });
  const warnings = input.to === "paid" && deps.discountStock ? await deps.discountStock(currentQuote(sale)!.lines, sale.orderNumber ?? sale.number) : [];
  return { sale: (await deps.repository.get(sale.id))!, warnings };
}
