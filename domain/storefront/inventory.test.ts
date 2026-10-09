import { describe, expect, it } from "vitest";
import { parseStorefront } from "@/domain/config/storefront";
import { applyInventory, catalogVariants, inventoryCsv, movementDelta, parseCsv, planInventoryImport, stockStatus, variantKey, type InventoryRecord } from "./inventory";

const storefront = parseStorefront({
  catalogEyebrow: "Catálogo",
  catalogTitle: "Frutos secos",
  catalogDescription: "Todo lo que vendemos, por kilo.",
  categories: [{ key: "frutos-secos", name: "Frutos secos" }],
  products: [
    { key: "nuez", name: "Nuez cuartillo", category: "frutos-secos", formats: [{ label: "500 g" }, { label: "1 kg", price: 9000 }] },
    { key: "mani", name: "Maní salado", category: "frutos-secos" },
  ],
  highlights: [{ title: "Despacho", text: "A todo Chile en 48 horas." }],
  howToBuyTitle: "Cómo comprar",
  howToBuy: [{ title: "Elige", text: "Arma tu pedido en el carro." }],
  orderGreeting: "Hola, quiero hacer este pedido:",
});

const record = (key: string, patch: Partial<InventoryRecord> = {}): InventoryRecord => ({
  variantKey: key, productKey: key.split("::")[0], productName: "x", formatLabel: key.split("::")[1], active: true, trackStock: false, stock: 0, lowStockThreshold: 5, ...patch,
});

describe("inventario de la tienda", () => {
  it("lista una presentación por formato y una por producto sin formatos", () => {
    expect(catalogVariants(storefront).map((variant) => variant.variantKey)).toEqual(["nuez::500 g", "nuez::1 kg", "mani::"]);
    expect(variantKey("mani")).toBe("mani::");
  });

  it("calcula el estado del stock", () => {
    expect(stockStatus(undefined)).toBe("untracked");
    expect(stockStatus({ trackStock: true, stock: 0, lowStockThreshold: 5 })).toBe("out");
    expect(stockStatus({ trackStock: true, stock: 5, lowStockThreshold: 5 })).toBe("low");
    expect(stockStatus({ trackStock: true, stock: 6, lowStockThreshold: 5 })).toBe("in_stock");
  });

  it("aplica precio, SKU, estado y desactivaciones de la base a la vitrina", () => {
    const result = applyInventory(storefront, [
      record("nuez::500 g", { price: 4990, sku: "NUEZ-500", trackStock: true, stock: 2 }),
      record("nuez::1 kg", { active: false }),
      record("mani::", { price: 3500 }),
    ]);
    expect(result.products[0].formats).toEqual([{ label: "500 g", price: 4990, sku: "NUEZ-500", stock: "low" }]);
    expect(result.products[1]).toMatchObject({ price: 3500, stock: "untracked" });
    expect(applyInventory(storefront, [record("mani::", { active: false })]).products.map((product) => product.key)).toEqual(["nuez"]);
    expect(applyInventory(storefront, [])).toBe(storefront);
  });

  it("convierte lo ingresado en un movimiento con signo", () => {
    expect(movementDelta({ kind: "purchase", quantity: 10 }, 3)).toEqual({ quantity: 10, reason: "purchase" });
    expect(movementDelta({ kind: "waste", quantity: 2 }, 3)).toEqual({ quantity: -2, reason: "waste" });
    expect(movementDelta({ kind: "count", quantity: 1 }, 3)).toEqual({ quantity: -2, reason: "adjustment" });
    expect(movementDelta({ kind: "count", quantity: 3 }, 3)).toBeUndefined();
  });

  it("exporta e importa la planilla", () => {
    const variants = catalogVariants(storefront);
    const csv = inventoryCsv(variants, [record("nuez::500 g", { price: 4990, trackStock: true, stock: 7 })]);
    expect(parseCsv(csv)[1]).toEqual(["nuez::500 g", "Nuez cuartillo", "500 g", "", "4990", "7", "si"]);

    const edited = "codigo;producto;presentacion;sku;precio;stock;activo\nnuez::500 g;Nuez;500 g;NUEZ-500;$4.990;12;si\n;Maní;;MANI-1;;;\nmani::;Maní;;;3.500;;no\nnada::;x;;;;;\n";
    const { changes, errors } = planInventoryImport(edited, variants, []);
    expect(changes).toEqual([
      { variantKey: "nuez::500 g", update: { sku: "NUEZ-500", price: 4990 }, countedStock: 12 },
      { variantKey: "mani::", update: { price: 3500, active: false }, countedStock: undefined },
    ]);
    expect(errors).toEqual(["Fila 3: el SKU MANI-1 no está en el catálogo.", "Fila 5: el código nada:: no está en el catálogo."]);
  });

  it("rechaza SKU repetidos y planillas sin columnas de identificación", () => {
    const variants = catalogVariants(storefront);
    const { errors } = planInventoryImport("codigo,sku\nnuez::500 g,X1\nnuez::1 kg,x1\n", variants, []);
    expect(errors[0]).toContain("X1");
    expect(() => planInventoryImport("producto;precio\nNuez;100\n", variants, [])).toThrow("codigo o sku");
  });
});

describe("planilla sin cambios", () => {
  it("no cuenta como cambio lo que ya está igual", () => {
    const variants = catalogVariants(storefront);
    const records = [record("nuez::500 g", { sku: "NUEZ-500", price: 4990, trackStock: true, stock: 12 })];
    const { changes } = planInventoryImport(inventoryCsv(variants, records), variants, records);
    expect(changes).toEqual([]);
  });
});
