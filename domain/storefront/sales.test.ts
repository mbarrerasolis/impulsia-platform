import { describe, expect, it } from "vitest";
import {
  canTransition, describeChanges, formatSaleNumber, missingForOrder, nextStatuses, parseSaleReference, quoteReference, quoteText, quoteTotals,
  type QuoteVersion, type Sale,
} from "./sales";

const money = (amount: number) => `$${amount.toLocaleString("es-CL")}`;
const line = (id: string, quantity: number, unitPrice: number) => ({ id, name: id.split("::")[0], format: id.split("::")[1], quantity, unitPrice });

describe("ventas de la tienda", () => {
  it("numera cotizaciones y pedidos con año, correlativo y versión", () => {
    expect(formatSaleNumber("COT", 2026, 128)).toBe("COT-2026-00128");
    expect(quoteReference("COT-2026-00128", 2)).toBe("COT-2026-00128-V2");
    expect(parseSaleReference("mi cotización es la cot 2026 128 v2")).toEqual({ prefix: "COT", number: "COT-2026-00128", version: 2 });
    expect(parseSaleReference("PED-2026-00004")).toEqual({ prefix: "PED", number: "PED-2026-00004" });
    expect(parseSaleReference("hola")).toBeUndefined();
  });

  it("desglosa neto e IVA de precios que ya lo incluyen y suma el transporte", () => {
    expect(quoteTotals([line("almendra::1 kg", 2, 15470)], 0.19)).toEqual({ products: 30940, net: 26000, vat: 4940, total: 30940 });
    expect(quoteTotals([line("almendra::1 kg", 1, 11900)], 0.19, 5000)).toEqual({ products: 11900, net: 10000, vat: 1900, shipping: 5000, total: 16900 });
  });

  it("el asistente no aprueba pagos, no despacha ni cancela", () => {
    expect(canTransition("quote_sent", "quote_accepted", "assistant")).toBe(true);
    expect(canTransition("payment_pending", "payment_in_review", "assistant")).toBe(true);
    expect(canTransition("payment_in_review", "paid", "assistant")).toBe(false);
    expect(canTransition("payment_in_review", "paid", "panel")).toBe(true);
    expect(canTransition("quote_sent", "cancelled", "assistant")).toBe(false);
    expect(canTransition("shipped", "cancelled", "panel")).toBe(false);
    expect(nextStatuses("paid", "panel")).toEqual(["preparing", "cancelled"]);
  });

  it("exige datos completos para pasar a pedido", () => {
    const quote: QuoteVersion = { version: 1, createdAt: "2026-10-08T12:00:00Z", lines: [line("almendra::1 kg", 1, 15470)], totals: quoteTotals([line("almendra::1 kg", 1, 15470)], 0.19), validUntil: "2026-10-11T12:00:00Z", createdVia: "assistant" };
    const sale: Pick<Sale, "customer" | "destination" | "deliveryMode" | "paymentMethod" | "document" | "billing" | "versions" | "currentVersion"> = {
      customer: { name: "Ana", kind: "negocio", company: "Almacén Ana", taxId: "", phone: "", email: "" },
      destination: "Temuco", deliveryMode: "despacho", versions: [quote], currentVersion: 1,
    };
    expect(missingForOrder(sale)).toEqual(["teléfono o email del cliente", "costo de transporte", "forma de pago", "boleta o factura"]);
    expect(missingForOrder({ ...sale, customer: { ...sale.customer, phone: "+56911112222" }, deliveryMode: "retiro", paymentMethod: "transfer", document: "factura" })).toEqual(["datos de facturación"]);
  });

  it("describe los cambios entre versiones", () => {
    const before = { lines: [line("almendra::1 kg", 2, 15470), line("nuez::500 g", 1, 6000)], totals: quoteTotals([], 0.19) };
    const after = { lines: [line("almendra::1 kg", 6, 13080), line("pasas::1 kg", 1, 5000)], totals: quoteTotals([], 0.19, 4000) };
    expect(describeChanges(before, after, money)).toBe("almendra 1 kg: 2 → 6; agrega 1 × pasas 1 kg; quita nuez 500 g; transporte: por confirmar → $4.000");
  });

  it("arma el texto de la cotización con todo lo que pide el manual", () => {
    const lines = [line("almendra::1 kg", 2, 15470)];
    const text = quoteText(
      { number: "COT-2026-00001", customer: { name: "Ana", kind: "negocio", company: "Almacén Ana", taxId: "76.123.456-7", phone: "", email: "" }, destination: "Temuco", deliveryMode: "despacho" },
      { version: 2, createdAt: "2026-10-08T12:00:00Z", lines, totals: quoteTotals(lines, 0.19), validUntil: "2026-10-11T12:00:00Z", createdVia: "assistant" },
      money, (iso) => iso.slice(0, 10),
    );
    expect(text).toContain("Cotización COT-2026-00001-V2 — 2026-10-08");
    expect(text).toContain("Almacén Ana · RUT 76.123.456-7");
    expect(text).toContain("Neto: $26.000 · IVA: $4.940 · Productos: $30.940");
    expect(text).toContain("Transporte: por confirmar");
    expect(text).toContain("Vigencia: hasta 2026-10-11");
  });
});
