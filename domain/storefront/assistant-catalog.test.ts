import { describe, expect, it } from "vitest";
import { parseStorefront } from "@/domain/config/storefront";
import { describeForAssistant, orderSummary, quoteOrder, searchProducts } from "./assistant-catalog";

const storefront = parseStorefront({
  catalogEyebrow: "Catálogo",
  catalogTitle: "Frutos secos",
  catalogDescription: "Todo lo que vendemos, por kilo.",
  categories: [{ key: "frutos-secos", name: "Frutos secos" }, { key: "gomitas", name: "Gomitas" }],
  products: [
    { key: "almendra-nonpareil", name: "Almendra Nonpareil", category: "frutos-secos", sku: "12-11", net: { base: 12999, bulk: 10990 }, formats: [{ label: "500 g", grams: 500 }, { label: "1 kg", grams: 1000 }] },
    { key: "nuez", name: "Nuez mariposa", category: "frutos-secos", net: { base: 8190, bulk: 7990 }, formats: [{ label: "500 g", grams: 500 }, { label: "1 kg", grams: 1000, stock: "out" }] },
    { key: "gomita-osito", name: "Gomita osito 500 g", category: "gomitas", unit: "bolsa de 500 g", net: { base: 2990, bulk: 2495 } },
  ],
  highlights: [{ title: "Despacho", text: "A todo Chile en 48 horas." }],
  howToBuyTitle: "Cómo comprar",
  howToBuy: [{ title: "Elige", text: "Arma tu pedido en el carro." }],
  orderGreeting: "Hola, quiero hacer este pedido:",
});
const money = (amount: number) => `$${amount.toLocaleString("es-CL")}`;

describe("catálogo para el asistente", () => {
  it("busca por nombre con plurales y sin tildes", () => {
    expect(searchProducts(storefront, "almendras").map((product) => product.key)).toEqual(["almendra-nonpareil"]);
    expect(searchProducts(storefront, "nueces").map((product) => product.key)).toEqual(["nuez"]);
    expect(searchProducts(storefront, "gomitas")[0].key).toBe("gomita-osito");
    expect(searchProducts(storefront, "")).toEqual([]);
  });

  it("describe presentaciones, tramo, mayorista y stock", () => {
    const card = describeForAssistant(storefront, storefront.products[1], money, "https://distribuidorasecos.cl");
    expect(card.presentaciones).toEqual([{ presentacion: "500 g", precio_con_iva: "$4.870", stock: "disponible" }, { presentacion: "1 kg", precio_con_iva: "$9.750", stock: "sin stock" }]);
    expect(card.precio_por_volumen).toContain("desde 6 kg");
    expect(card.enlace).toBe("https://distribuidorasecos.cl/productos/nuez");
  });

  it("cotiza aplicando el tramo por producto y avisa problemas", () => {
    const quote = quoteOrder(storefront, [
      { clave: "almendra-nonpareil", presentacion: "1kg", cantidad: 6 },
      { clave: "nuez", presentacion: "1 kg", cantidad: 1 },
      { clave: "gomita-osito", cantidad: 2 },
      { clave: "inventado", cantidad: 1 },
    ]);
    expect(quote.lines.map((line) => [line.name, line.quantity, line.price])).toEqual([["Almendra Nonpareil", 6, 13080], ["Gomita osito 500 g", 2, 3560]]);
    expect(quote.total).toBe(6 * 13080 + 2 * 3560);
    expect(quote.problems).toEqual(["Nuez mariposa 1 kg está sin stock.", "No existe el producto \"inventado\"; búscalo con buscar_productos."]);
    expect(orderSummary(quote.lines, money, quote.total)).toContain("• 6 × Almendra Nonpareil (1 kg) [12-11] — $78.480");
  });
});
