import { beforeEach, describe, expect, it } from "vitest";
import { parseStorefront } from "@/domain/config/storefront";
import { MemorySaleRepository } from "@/repositories/memory/memory-sale-repository";
import { acceptQuote, changeStatus, choosePayment, createQuote, registerTransfer, reviewPayment, reviseQuote, type SalesDeps } from "./sales";

const storefront = parseStorefront({
  catalogEyebrow: "Catálogo",
  catalogTitle: "Frutos secos",
  catalogDescription: "Todo lo que vendemos, por kilo.",
  categories: [{ key: "frutos-secos", name: "Frutos secos" }],
  products: [
    { key: "almendra", name: "Almendra Nonpareil", category: "frutos-secos", net: { base: 12999, bulk: 10990 }, formats: [{ label: "500 g", grams: 500 }, { label: "1 kg", grams: 1000 }] },
    { key: "nuez", name: "Nuez mariposa", category: "frutos-secos", formats: [{ label: "1 kg", grams: 1000 }] },
  ],
  highlights: [{ title: "Despacho", text: "A todo Chile con transporte asociado." }],
  howToBuyTitle: "Cómo comprar",
  howToBuy: [{ title: "Elige", text: "Arma tu pedido en el carro." }],
  orderGreeting: "Hola, quiero hacer este pedido:",
});

const customer = { name: "Ana Pérez", kind: "negocio" as const, company: "Almacén Ana", taxId: "76.123.456-7", phone: "+56911112222", email: "" };
let clock = new Date("2026-10-08T12:00:00-03:00");
const stockCalls: string[] = [];
const deps: SalesDeps = {
  repository: new MemorySaleRepository(),
  storefront,
  money: (amount) => `$${amount.toLocaleString("es-CL")}`,
  now: () => clock,
  discountStock: async (lines, reference) => { stockCalls.push(`${reference}:${lines.map((line) => `${line.quantity}×${line.id}`).join(",")}`); return []; },
};

async function quoted() {
  const { sale } = await createQuote(deps, { customer, destination: "Temuco", deliveryMode: "despacho", items: [{ clave: "almendra", presentacion: "1 kg", cantidad: 2 }], via: "assistant", conversationId: "conv-1" });
  return sale;
}

describe("flujo de venta de la tienda", () => {
  beforeEach(() => {
    MemorySaleRepository.reset();
    clock = new Date("2026-10-08T12:00:00-03:00");
    stockCalls.length = 0;
  });

  it("crea la cotización V1 con precios del catálogo y la deja enviada si la emite el asistente", async () => {
    const sale = await quoted();
    expect(sale).toMatchObject({ number: "COT-2026-00001", status: "quote_sent", currentVersion: 1, conversationId: "conv-1" });
    expect(sale.versions[0]).toMatchObject({ lines: [{ id: "almendra::1 kg", quantity: 2, unitPrice: 15470 }], totals: { products: 30940, net: 26000, vat: 4940, total: 30940 } });
    expect(sale.versions[0].validUntil).toBe("2026-10-11T15:00:00.000Z");
    expect((await quoted()).number).toBe("COT-2026-00002");
  });

  it("guarda el teléfono normalizado, lo busca escrito como sea y rechaza uno inválido", async () => {
    const base = { destination: "Temuco", deliveryMode: "despacho" as const, items: [{ clave: "almendra", presentacion: "1 kg", cantidad: 1 }], via: "panel" as const };
    const { sale } = await createQuote(deps, { ...base, customer: { ...customer, phone: "9 8765 4321" } });
    expect(sale.customer.phone).toBe("+56987654321");
    for (const query of ["987654321", "+56 9 8765 4321", "56987654321"]) {
      expect((await deps.repository.list({ query, limit: 10 })).map((item) => item.id), query).toEqual([sale.id]);
    }
    expect(await deps.repository.list({ query: "Ana", limit: 10 })).toHaveLength(1);
    await expect(createQuote(deps, { ...base, customer: { ...customer, phone: "1234" } })).rejects.toThrow("El teléfono no es válido");
  });

  it("no emite cotizaciones con productos sin precio ni inexistentes", async () => {
    await expect(createQuote(deps, { customer, destination: "Temuco", deliveryMode: "despacho", items: [{ clave: "nuez", presentacion: "1 kg", cantidad: 1 }], via: "assistant" })).rejects.toThrow("sin precio");
    await expect(createQuote(deps, { customer, destination: "Temuco", deliveryMode: "despacho", items: [{ clave: "pistacho", presentacion: "", cantidad: 1 }], via: "assistant" })).rejects.toThrow("no tiene productos válidos");
  });

  it("modificar crea una versión nueva con el tramo recalculado y pide aceptarla de nuevo", async () => {
    const sale = await quoted();
    await acceptQuote(deps, sale.id, { via: "assistant" });
    const { sale: revised, changes } = await reviseQuote(deps, sale.id, { items: [{ clave: "almendra", presentacion: "1 kg", cantidad: 6 }], shipping: 8000, via: "assistant" });
    expect(revised).toMatchObject({ status: "quote_revised", currentVersion: 2 });
    expect(revised.versions[1].totals).toMatchObject({ products: 6 * 13080, shipping: 8000, total: 6 * 13080 + 8000 });
    expect(changes).toBe("Almendra Nonpareil 1 kg: 2 → 6; transporte: por confirmar → $8.000");
    await expect(acceptQuote(deps, sale.id, { version: 1, via: "assistant" })).rejects.toThrow("fue reemplazada");
    expect((await acceptQuote(deps, sale.id, { version: 2, via: "assistant" })).status).toBe("quote_accepted");
  });

  it("el asistente no acepta una cotización vencida", async () => {
    const sale = await quoted();
    clock = new Date("2026-10-12T12:00:00-03:00");
    await expect(acceptQuote(deps, sale.id, { via: "assistant" })).rejects.toThrow("vencida");
  });

  it("con los datos completos pasa a pedido con pago pendiente; si faltan, dice qué falta", async () => {
    const sale = await quoted();
    await acceptQuote(deps, sale.id, { via: "assistant" });
    await expect(choosePayment(deps, sale.id, { method: "transfer", document: "factura", via: "assistant" })).rejects.toThrow("costo de transporte, datos de facturación");
    const order = await choosePayment(deps, sale.id, { method: "transfer", document: "boleta", deliveryMode: "retiro", via: "assistant" });
    expect(order).toMatchObject({ status: "payment_pending", orderNumber: "PED-2026-00001", paymentMethod: "transfer", deliveryMode: "retiro" });
  });

  it("la transferencia queda en revisión; sólo el equipo la aprueba y ahí se descuenta el stock", async () => {
    const sale = await quoted();
    await acceptQuote(deps, sale.id, { via: "assistant" });
    await choosePayment(deps, sale.id, { method: "transfer", document: "boleta", deliveryMode: "retiro", via: "assistant" });
    const { sale: inReview, payment, matches } = await registerTransfer(deps, sale.id, { amount: 30000, payer: "Ana Pérez", via: "assistant" });
    expect(inReview.status).toBe("payment_in_review");
    expect(matches).toBe(false);
    expect(payment).toMatchObject({ status: "in_review", amount: 30000, expectedAmount: 30940, quoteVersion: 1 });
    await expect(changeStatus(deps, sale.id, { to: "paid", via: "assistant" })).rejects.toThrow("no admite");
    await expect(changeStatus(deps, sale.id, { to: "paid", via: "panel" })).rejects.toThrow("comprobante en revisión");

    const rejected = await reviewPayment(deps, sale.id, { paymentId: payment.id, approve: false, note: "Monto distinto" });
    expect(rejected.sale.status).toBe("payment_pending");
    const second = await registerTransfer(deps, sale.id, { amount: 30940, via: "assistant" });
    expect(second.matches).toBe(true);
    const approved = await reviewPayment(deps, sale.id, { paymentId: second.payment.id, approve: true });
    expect(approved.sale.status).toBe("paid");
    expect(stockCalls).toEqual(["PED-2026-00001:2×almendra::1 kg"]);
    await expect(reviewPayment(deps, sale.id, { paymentId: second.payment.id, approve: true })).rejects.toThrow("ya fue revisado");
  });

  it("no modifica en silencio una venta pagada y exige seguimiento para despachar", async () => {
    const sale = await quoted();
    await acceptQuote(deps, sale.id, { via: "assistant" });
    await choosePayment(deps, sale.id, { method: "gateway", document: "boleta", deliveryMode: "despacho", via: "assistant" }).catch(() => undefined);
    await reviseQuote(deps, sale.id, { shipping: 5000, via: "panel" });
    await acceptQuote(deps, sale.id, { via: "panel" });
    await choosePayment(deps, sale.id, { method: "gateway", document: "boleta", via: "panel" });
    await changeStatus(deps, sale.id, { to: "paid", via: "panel", note: "Pagado en la página" });
    await expect(reviseQuote(deps, sale.id, { shipping: 0, via: "assistant" })).rejects.toThrow("ya no admite cambios");
    await changeStatus(deps, sale.id, { to: "preparing", via: "panel" });
    await changeStatus(deps, sale.id, { to: "ready_to_ship", via: "panel" });
    await expect(changeStatus(deps, sale.id, { to: "shipped", via: "panel" })).rejects.toThrow("seguimiento");
    const { sale: shipped } = await changeStatus(deps, sale.id, { to: "shipped", tracking: "Starken 123456", via: "panel" });
    expect(shipped).toMatchObject({ status: "shipped", tracking: "Starken 123456" });
    expect(shipped.events.map((event) => event.to)).toEqual(["quote_sent", "quote_accepted", "quote_revised", "quote_accepted", "payment_pending", "paid", "preparing", "ready_to_ship", "shipped"]);
  });
});
