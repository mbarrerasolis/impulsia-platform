import { describe, expect, it } from "vitest";
import { featuredProducts, groupProducts, mixQuote, orderHref, orderMessage, orderTotal, parseStorefront, reviewSummary, skuFor } from "./storefront";

const base = {
  catalogEyebrow: "Catálogo",
  catalogTitle: "Nuestros productos",
  catalogDescription: "Todo lo que vendemos, por categoría.",
  categories: [{ key: "harinas", name: "Harinas" }, { key: "semillas", name: "Semillas" }, { key: "vacia", name: "Vacía" }],
  products: [
    { key: "harina-de-coco", name: "Harina de coco", category: "harinas", formats: [{ label: "500 g", price: 3990 }] },
    { key: "chia", name: "Chía", category: "semillas" },
  ],
  highlights: [{ title: "Despacho", text: "Llevamos tu pedido a domicilio." }],
  howToBuyTitle: "Cómo comprar",
  howToBuy: [{ title: "Arma tu pedido", text: "Elige productos y cantidades." }],
  orderGreeting: "Hola, quiero hacer este pedido:",
};

describe("storefront", () => {
  it("parses products with defaults", () => {
    const storefront = parseStorefront(base);
    expect(storefront.products[1]).toMatchObject({ formats: [], tags: [] });
  });

  it("rejects unknown categories and duplicated products", () => {
    expect(() => parseStorefront({ ...base, products: [{ key: "x", name: "Producto X", category: "nope" }] })).toThrow(/categoría nope/);
    expect(() => parseStorefront({ ...base, products: [base.products[0], base.products[0]] })).toThrow(/duplicado/);
  });

  it("groups products by category in manifest order and drops empty categories", () => {
    const groups = groupProducts(parseStorefront(base));
    expect(groups.map((group) => group.category.key)).toEqual(["harinas", "semillas"]);
  });

  it("builds the order message skipping zero quantities", () => {
    expect(orderMessage("Hola:", [
      { name: "Harina de coco", format: "500 g", quantity: 2 },
      { name: "Chía", quantity: 0 },
      { name: "Chía", quantity: 1 },
    ])).toBe("Hola:\n• 2 × Harina de coco (500 g)\n• 1 × Chía");
  });

  it("picks featured products or falls back to the first of each category", () => {
    const storefront = parseStorefront(base);
    expect(featuredProducts(storefront).map((product) => product.key)).toEqual(["harina-de-coco", "chia"]);
    const marked = parseStorefront({ ...base, products: [base.products[0], { ...base.products[1], featured: true }] });
    expect(featuredProducts(marked).map((product) => product.key)).toEqual(["chia"]);
  });

  it("summarizes reviews only when there are some", () => {
    expect(reviewSummary([])).toBeUndefined();
    expect(reviewSummary([{ rating: 5, text: "Muy rico", author: "Ana" }, { rating: 4, text: "Bueno", author: "Luis" }, { rating: 5, text: "Excelente", author: "Sofía" }])).toEqual({ average: 4.7, count: 3 });
  });

  it("splits a mix in equal parts and prices it only when every ingredient has a price", () => {
    const mix = { grams: 1000, ingredients: [
      { key: "nuez", name: "Nuez", pricePerKg: 8000, color: "#000000" },
      { key: "pasa", name: "Pasa", pricePerKg: 4000, color: "#000000" },
      { key: "mani", name: "Maní", color: "#000000" },
    ] };
    const quote = mixQuote(mix, ["nuez", "pasa"]);
    expect(quote.parts.map((part) => part.grams)).toEqual([500, 500]);
    expect(quote.price).toBe(6000);
    const thirds = mixQuote(mix, ["nuez", "pasa", "mani"]);
    expect(thirds.parts.reduce((sum, part) => sum + part.grams, 0)).toBe(1000);
    expect(thirds.price).toBeUndefined();
    expect(mixQuote(mix, [])).toEqual({ parts: [], price: undefined });
  });

  it("prices a wholesale mix from net prices and adds tax for the cart", () => {
    const mix = { grams: 3000, wholesale: true, ingredients: [
      { key: "nuez", name: "Nuez", pricePerKg: 8190, color: "#000000" },
      { key: "mani", name: "Maní", pricePerKg: 3690, color: "#000000" },
    ] };
    const quote = mixQuote(mix, ["nuez", "mani"], { taxRate: 0.19, bulkFrom: 6, roundTo: 10 });
    expect(quote.parts.map((part) => part.grams)).toEqual([1500, 1500]);
    expect(quote.net).toBe(17820);
    expect(quote.price).toBe(21210);
  });

  it("totals an order only when every line has a price", () => {
    expect(orderTotal([{ name: "A", quantity: 2, price: 1000 }, { name: "B", quantity: 1, price: 500 }])).toBe(2500);
    expect(orderTotal([{ name: "A", quantity: 2, price: 1000 }, { name: "B", quantity: 1 }])).toBeUndefined();
    expect(orderMessage("Hola:", [{ name: "A", quantity: 2, price: 1000 }], (amount) => `$${amount}`)).toBe("Hola:\n• 2 × A — $2000");
  });

  it("keeps SKUs per format, rejects duplicates and puts them in the order", () => {
    const storefront = parseStorefront({ ...base, products: [
      { key: "nuez", name: "Nuez", category: "harinas", formats: [{ label: "500 g", sku: "NUE-500" }, { label: "1 kg", sku: "NUE-1000" }] },
      { key: "chia", name: "Chía", category: "semillas", sku: "CHI-GR" },
    ] });
    expect(skuFor(storefront.products[0], "1 kg")).toBe("NUE-1000");
    expect(skuFor(storefront.products[1])).toBe("CHI-GR");
    expect(() => parseStorefront({ ...base, products: [
      { key: "a", name: "Producto A", category: "harinas", sku: "x-1" },
      { key: "b", name: "Producto B", category: "harinas", formats: [{ label: "1 kg", sku: "X-1" }] },
    ] })).toThrow(/SKU duplicado/);
    expect(orderMessage("Hola:", [{ name: "Nuez", format: "1 kg", sku: "NUE-1000", quantity: 1 }])).toBe("Hola:\n• 1 × Nuez (1 kg) [NUE-1000]");
  });

  it("links to WhatsApp when there is a number and to email otherwise", () => {
    expect(orderHref("Hola", { whatsappNumber: "+56 9 1234 5678", email: "a@b.cl" })).toBe("https://wa.me/56912345678?text=Hola");
    expect(orderHref("Hola", { email: "a@b.cl" })).toBe("mailto:a@b.cl?subject=Pedido&body=Hola");
  });
});
