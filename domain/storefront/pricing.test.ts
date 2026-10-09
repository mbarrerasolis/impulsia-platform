import { describe, expect, it } from "vitest";
import { defaultPriceRules as rules, grossPrice, missingForBulk, priceLines, productPricing, tierNet } from "./pricing";

const almendra = { key: "almendra", net: { base: 10990, bulk: 9990 } };
const gomita = { key: "gomita", unit: "bolsa de 500 g", net: { base: 2990, bulk: 2495 } };

describe("precios por tramo", () => {
  it("suma IVA y redondea a la decena", () => {
    expect(grossPrice(10990, 1, rules)).toBe(13080);
    expect(grossPrice(10990, 0.5, rules)).toBe(6540);
  });

  it("usa el tramo por volumen desde 6 kg o unidades", () => {
    expect(tierNet(almendra.net, 5.5, rules)).toBe(10990);
    expect(tierNet(almendra.net, 6, rules)).toBe(9990);
    expect(tierNet({ base: 3700 }, 20, rules)).toBe(3700);
  });

  it("calcula el tamaño por kilo o por unidad", () => {
    expect(productPricing(almendra, 500)).toEqual({ productKey: "almendra", size: 0.5, base: 10990, bulk: 9990 });
    expect(productPricing(gomita, 500)?.size).toBe(1);
    expect(productPricing({ key: "x" })).toBeUndefined();
  });

  it("aplica el tramo sumando todas las presentaciones del mismo producto", () => {
    const lines = priceLines([
      { id: "a-1kg", quantity: 5, pricing: productPricing(almendra, 1000) },
      { id: "a-500", quantity: 2, pricing: productPricing(almendra, 500) },
      { id: "g", quantity: 2, pricing: productPricing(gomita) },
      { id: "fija", quantity: 1, price: 1500 },
    ], rules);
    expect(lines.map((line) => line.price)).toEqual([grossPrice(9990, 1, rules), grossPrice(9990, 0.5, rules), grossPrice(2990, 1, rules), 1500]);
  });

  it("indica cuánto falta para el precio por volumen", () => {
    const pricing = productPricing(almendra, 1000)!;
    expect(missingForBulk(pricing, 4, rules)).toBe(2);
    expect(missingForBulk(pricing, 6, rules)).toBeUndefined();
    expect(missingForBulk({ ...pricing, bulk: undefined }, 1, rules)).toBeUndefined();
  });
});
