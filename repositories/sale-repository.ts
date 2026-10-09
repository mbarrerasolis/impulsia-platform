import type { BillingData, DeliveryMode, PaymentMethod, PaymentStatus, QuoteVersion, Sale, SaleActor, SaleCustomer, SalePayment, SaleStatus } from "@/domain/storefront/sales";

export interface NewSaleEvent {
  from?: SaleStatus;
  to: SaleStatus;
  via: SaleActor;
  note?: string;
  actorId?: string;
}

export type NewQuoteVersion = Omit<QuoteVersion, "createdAt"> & { createdBy?: string };

export interface NewSale {
  number: string;
  status: SaleStatus;
  leadId?: string;
  conversationId?: string;
  customer: SaleCustomer;
  destination: string;
  deliveryMode: DeliveryMode;
  notes?: string;
}

/** Campos de la venta que cambian sin crear versión (datos del cliente, entrega, pago, despacho). */
export interface SalePatch {
  status?: SaleStatus;
  orderNumber?: string;
  customer?: SaleCustomer;
  destination?: string;
  deliveryMode?: DeliveryMode;
  carrier?: string | null;
  paymentMethod?: PaymentMethod;
  document?: Sale["document"];
  billing?: BillingData;
  tracking?: string | null;
  notes?: string | null;
}

export type NewPayment = Omit<SalePayment, "id" | "createdAt" | "status" | "reviewedAt" | "reviewNote">;

export interface SaleListFilter {
  statuses?: readonly SaleStatus[];
  /** Número, cliente, empresa o teléfono. */
  query?: string;
  limit: number;
}

/**
 * Ventas de la tienda. Escribe sólo el servidor (asistente o rutas del panel después de validar el
 * rol); cada cambio de estado deja su evento.
 */
export interface SaleRepository {
  /** Correlativo del año: COT-2026-00001, PED-2026-00001. */
  nextNumber(prefix: "COT" | "PED", year: number): Promise<string>;
  create(sale: NewSale, version: NewQuoteVersion, event: NewSaleEvent): Promise<Sale>;
  get(id: string): Promise<Sale | undefined>;
  /** Por número de cotización o de pedido. */
  findByNumber(number: string): Promise<Sale | undefined>;
  /** La venta abierta más reciente de una conversación (el asistente sigue con ella). */
  findOpenByConversation(conversationId: string): Promise<Sale | undefined>;
  list(filter: SaleListFilter): Promise<Sale[]>;
  addVersion(saleId: string, version: NewQuoteVersion, status: SaleStatus, event: NewSaleEvent): Promise<void>;
  update(saleId: string, patch: SalePatch, event?: NewSaleEvent): Promise<void>;
  addPayment(saleId: string, payment: NewPayment): Promise<SalePayment>;
  reviewPayment(paymentId: string, status: Exclude<PaymentStatus, "in_review">, note: string | undefined, reviewerId?: string): Promise<void>;
}

/** Dígitos de una búsqueda que parece teléfono (6 o más), sin el 56 de Chile: así "9 1234 5678" encuentra "+56912345678". */
export function phoneDigits(query: string | undefined) {
  if (!query || /[a-z]/i.test(query)) return undefined;
  const digits = query.replace(/\D/g, "");
  if (digits.length < 6) return undefined;
  return digits.length === 11 && digits.startsWith("56") ? digits.slice(2) : digits;
}

/** Estados en que una venta sigue abierta para el asistente. */
export const openSaleStatuses: readonly SaleStatus[] = ["quote_draft", "quote_sent", "quote_revised", "quote_accepted", "payment_pending", "payment_in_review"];
