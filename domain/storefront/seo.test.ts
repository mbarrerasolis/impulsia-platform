import { describe, expect, it } from "vitest";
import { productMetaDescription, productTitle } from "./seo";

describe("SEO de la ficha de producto", () => {
  it("arma una meta descripción con qué es, precio y despacho", () => {
    const text = productMetaDescription({
      name: "Almendra Nonpareil",
      description: "Almendra entera variedad Nonpareil, cosecha 2026: grande, pareja y de sabor suave. Para picar o repostería.",
      priceFrom: { amount: "$7.730", format: "500 g" },
      closing: "Despacho a todo Chile.",
    });
    expect(text).toBe("Almendra entera variedad Nonpareil, cosecha 2026: grande, pareja y de sabor suave. Desde $7.730 (500 g) IVA incluido. Despacho a todo Chile.");
    expect(text.length).toBeLessThanOrEqual(158);
  });

  it("recorta descripciones largas sin perder el precio", () => {
    const text = productMetaDescription({ name: "X", description: `${"palabra ".repeat(40)}final.`, priceFrom: { amount: "$1.000" }, closing: "Despacho a todo Chile." });
    expect(text.length).toBeLessThanOrEqual(158);
    expect(text).toContain("… Desde $1.000 IVA incluido. Despacho a todo Chile.");
  });

  it("avisa cuando no hay stock y titula por kilo", () => {
    expect(productMetaDescription({ name: "Damasco turco", soldOut: true })).toBe("Damasco turco. Pronto de vuelta.");
    expect(productTitle({ name: "Chía" }, true)).toBe("Chía por kilo");
    expect(productTitle({ name: "Gomita osito 500 g" }, false)).toBe("Gomita osito 500 g");
  });
});
