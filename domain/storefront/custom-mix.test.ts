import { describe, expect, it } from "vitest";
import { mixLineId, quoteCustomMix, quoteMixLine, rebalance, suggestedGrams } from "./custom-mix";

const rules = { taxRate: 0.19, bulkFrom: 6, roundTo: 10 };
const mix = {
  grams: 3000, minIngredientGrams: 600, stepGrams: 100, maxItems: 6, wholesale: true,
  ingredients: ["nuez", "mani", "almendra", "caju", "goji", "pasa", "coco"].map((key, index) => ({ key, name: key, color: "#000000", pricePerKg: 3000 + index * 1000 })),
};

describe("mix a medida", () => {
  it("propone gramos que cumplen el mínimo por ingrediente y el total", () => {
    expect(suggestedGrams(mix, 1)).toBe(3000);
    expect(suggestedGrams(mix, 2)).toBe(1500);
    expect(suggestedGrams(mix, 4)).toBe(800);
    expect(suggestedGrams(mix, 6)).toBe(600);
    expect(rebalance(mix, ["nuez", "mani", "goji"])).toEqual([{ key: "nuez", grams: 1000 }, { key: "mani", grams: 1000 }, { key: "goji", grams: 1000 }]);
  });

  it("valida mínimo por ingrediente, pasos, total y máximo de ingredientes", () => {
    expect(quoteCustomMix(mix, [{ key: "nuez", grams: 500 }, { key: "mani", grams: 650 }], rules).problems).toEqual(["nuez: mínimo 600 g.", "mani: en pasos de 100 g.", "Te faltan 1850 g para el mínimo de 3 kg."]);
    const seven = mix.ingredients.map((item) => ({ key: item.key, grams: 600 }));
    expect(quoteCustomMix(mix, seven, rules).problems).toContain("Máximo 6 ingredientes.");
  });

  it("valoriza neto y con IVA", () => {
    const quote = quoteCustomMix(mix, [{ key: "nuez", grams: 1800 }, { key: "mani", grams: 1200 }], rules);
    expect(quote).toMatchObject({ valid: true, totalGrams: 3000, net: 1.8 * 3000 + 1.2 * 4000, price: Math.round((1.8 * 3000 + 1.2 * 4000) * 1.19 / 10) * 10 });
  });

  it("codifica la línea del carro y el servidor la recalcula", () => {
    const id = mixLineId([{ key: "mani", grams: 1200 }, { key: "nuez", grams: 1800 }], true);
    expect(id).toBe("mix::mani:1200+nuez:1800");
    expect(quoteMixLine(mix, id, rules).net).toBe(10200);
    expect(quoteMixLine(mix, "mix::mani:100+nuez:100", rules).price).toBeUndefined();
  });
});

describe("agregar y quitar ingredientes", () => {
  it("conserva los gramos elegidos y completa el mínimo con el nuevo", async () => {
    const { addIngredient, removeIngredient } = await import("./custom-mix");
    const chosen = [{ key: "nuez", grams: 1500 }, { key: "mani", grams: 900 }];
    expect(addIngredient(mix, chosen, "goji")).toEqual([...chosen, { key: "goji", grams: 600 }]);
    expect(addIngredient(mix, [{ key: "nuez", grams: 1000 }], "mani")).toEqual([{ key: "nuez", grams: 1000 }, { key: "mani", grams: 2000 }]);
    expect(addIngredient(mix, [], "nuez")).toEqual([{ key: "nuez", grams: 3000 }]);
    expect(removeIngredient(chosen, "mani")).toEqual([{ key: "nuez", grams: 1500 }]);
  });
});
