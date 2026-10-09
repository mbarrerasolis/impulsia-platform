import { formatSaleNumber, saleErrors, type Sale, type SalePayment } from "@/domain/storefront/sales";
import { openSaleStatuses, phoneDigits, type NewPayment, type NewQuoteVersion, type NewSale, type NewSaleEvent, type SaleListFilter, type SalePatch, type SaleRepository } from "../sale-repository";

/** Modo demo: ventas en memoria del proceso, compartidas entre rutas y páginas vía globalThis. */
type DemoSales = { sales: Sale[]; counters: Map<string, number> };
const globalForDemo = globalThis as unknown as { impulsiaDemoSales?: DemoSales };
const store: DemoSales = globalForDemo.impulsiaDemoSales ??= { sales: [], counters: new Map() };

const now = () => new Date().toISOString();
const clone = (sale: Sale): Sale => structuredClone(sale);
const plain = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function toEvent(event: NewSaleEvent): Sale["events"][number] {
  return { id: crypto.randomUUID(), createdAt: now(), ...(event.from ? { from: event.from } : {}), to: event.to, via: event.via, ...(event.note ? { note: event.note } : {}) };
}

function toVersion(version: NewQuoteVersion) {
  const { createdBy, ...rest } = version;
  void createdBy;
  return { ...rest, createdAt: now() };
}

export class MemorySaleRepository implements SaleRepository {
  /** Sólo para pruebas. */
  static reset() {
    store.sales = [];
    store.counters = new Map();
  }

  async nextNumber(prefix: "COT" | "PED", year: number) {
    const key = `${prefix}-${year}`;
    const value = (store.counters.get(key) ?? 0) + 1;
    store.counters.set(key, value);
    return formatSaleNumber(prefix, year, value);
  }

  async create(sale: NewSale, version: NewQuoteVersion, event: NewSaleEvent) {
    const created: Sale = {
      id: crypto.randomUUID(),
      createdAt: now(),
      updatedAt: now(),
      ...sale,
      currentVersion: version.version,
      versions: [toVersion(version)],
      payments: [],
      events: [toEvent(event)],
    };
    store.sales.push(created);
    return clone(created);
  }

  private find(id: string) {
    const sale = store.sales.find((item) => item.id === id);
    if (!sale) throw new Error(saleErrors.notFound);
    return sale;
  }

  async get(id: string) {
    const sale = store.sales.find((item) => item.id === id);
    return sale ? clone(sale) : undefined;
  }

  async findByNumber(number: string) {
    const sale = store.sales.find((item) => item.number === number || item.orderNumber === number);
    return sale ? clone(sale) : undefined;
  }

  async findOpenByConversation(conversationId: string) {
    const sale = store.sales.filter((item) => item.conversationId === conversationId && openSaleStatuses.includes(item.status)).at(-1);
    return sale ? clone(sale) : undefined;
  }

  async list({ statuses, query, limit }: SaleListFilter) {
    const text = plain(query?.trim() ?? "");
    const digits = phoneDigits(query);
    return store.sales
      .filter((sale) => !statuses || statuses.includes(sale.status))
      .filter((sale) => !text || (digits
        ? sale.customer.phone.replace(/\D/g, "").includes(digits)
        : plain(`${sale.number} ${sale.orderNumber ?? ""} ${sale.customer.name} ${sale.customer.company}`).includes(text)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map(clone);
  }

  async addVersion(saleId: string, version: NewQuoteVersion, status: Sale["status"], event: NewSaleEvent) {
    const sale = this.find(saleId);
    sale.versions.push(toVersion(version));
    sale.currentVersion = version.version;
    sale.status = status;
    sale.events.push(toEvent(event));
    sale.updatedAt = now();
  }

  async update(saleId: string, patch: SalePatch, event?: NewSaleEvent) {
    const sale = this.find(saleId);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      (sale as unknown as Record<string, unknown>)[key] = value === null ? undefined : value;
    }
    if (event) sale.events.push(toEvent(event));
    sale.updatedAt = now();
  }

  async addPayment(saleId: string, payment: NewPayment) {
    const sale = this.find(saleId);
    const created: SalePayment = { id: crypto.randomUUID(), createdAt: now(), status: "in_review", ...payment };
    sale.payments.push(created);
    sale.updatedAt = now();
    return { ...created };
  }

  async reviewPayment(paymentId: string, status: "approved" | "rejected", note?: string) {
    const payment = store.sales.flatMap((sale) => sale.payments).find((item) => item.id === paymentId);
    if (!payment) throw new Error(saleErrors.paymentNotFound);
    if (payment.status !== "in_review") throw new Error(saleErrors.paymentReviewed);
    payment.status = status;
    payment.reviewedAt = now();
    if (note) payment.reviewNote = note;
  }
}
