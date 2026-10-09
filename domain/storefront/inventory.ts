import { z } from "zod";
import { formatPrice, type Storefront } from "@/domain/config/storefront";
import { defaultPriceRules } from "./pricing";

/**
 * Inventario de la tienda (fase A, sin ERP). El manifiesto de la edición describe el catálogo
 * (nombres, fotos, categorías, presentaciones); la base guarda lo comercial de cada presentación
 * (SKU, precio, si se vende, stock). El stock sólo cambia con movimientos.
 */

/** Quiénes del equipo cambian precios y stock (el resto del equipo interno sólo los ve). */
export const inventoryEditorRoles = ["owner_admin", "sales", "finance"] as const;

export { stockStatuses, stockStatusLabels, type StockStatus } from "./stock";
import type { StockStatus } from "./stock";

/** Movimientos que se registran a mano en el panel; `count` es un conteo físico (se guarda como ajuste). */
export const movementKinds = ["purchase", "count", "waste", "return", "sale"] as const;
export type MovementKind = (typeof movementKinds)[number];
export const movementKindLabels: Record<MovementKind, string> = {
  purchase: "Ingreso de mercadería",
  count: "Conteo físico (stock real)",
  waste: "Merma o pérdida",
  return: "Devolución de cliente",
  sale: "Venta fuera del sitio",
};

export const movementReasons = ["purchase", "adjustment", "waste", "return", "sale"] as const;
export type MovementReason = (typeof movementReasons)[number];
export const movementReasonLabels: Record<MovementReason, string> = {
  purchase: "Ingreso",
  adjustment: "Ajuste por conteo",
  waste: "Merma",
  return: "Devolución",
  sale: "Venta",
};

/** Lo comercial de una presentación, como está en la base. */
export interface InventoryRecord {
  variantKey: string;
  productKey: string;
  productName: string;
  formatLabel: string;
  sku?: string;
  price?: number;
  active: boolean;
  trackStock: boolean;
  stock: number;
  lowStockThreshold: number;
  updatedAt?: string;
}

export interface InventoryMovement {
  id: string;
  variantKey: string;
  productName: string;
  formatLabel: string;
  quantity: number;
  reason: MovementReason;
  note?: string;
  stockAfter: number;
  createdAt: string;
}

/** Una presentación del catálogo (manifiesto), con su código estable. */
export interface CatalogVariant {
  variantKey: string;
  productKey: string;
  productName: string;
  category: string;
  formatLabel: string;
  sku?: string;
  price?: number;
  /** Precio público calculado desde la lista por kilo (tramo base), si no hay precio fijo. */
  listPrice?: number;
}

/** Código estable de una presentación: producto + etiqueta (vacía si el producto no tiene presentaciones). */
export function variantKey(productKey: string, formatLabel = "") {
  return `${productKey}::${formatLabel}`;
}

export function catalogVariants(storefront: Pick<Storefront, "products"> & Partial<Pick<Storefront, "pricing">>): CatalogVariant[] {
  const rules = storefront.pricing ?? defaultPriceRules;
  return storefront.products.flatMap((product) => product.formats.length
    ? product.formats.map((format) => ({ variantKey: variantKey(product.key, format.label), productKey: product.key, productName: product.name, category: product.category, formatLabel: format.label, sku: format.sku, price: format.price, listPrice: formatPrice(product, { grams: format.grams }, rules) }))
    : [{ variantKey: variantKey(product.key), productKey: product.key, productName: product.name, category: product.category, formatLabel: "", sku: product.sku, price: product.price, listPrice: formatPrice(product, undefined, rules) }]);
}

export function stockStatus(record?: Pick<InventoryRecord, "trackStock" | "stock" | "lowStockThreshold">): StockStatus {
  if (!record?.trackStock) return "untracked";
  if (record.stock <= 0) return "out";
  return record.stock <= record.lowStockThreshold ? "low" : "in_stock";
}

/**
 * Vitrina con los datos de la base: precio y SKU de la base mandan sobre el manifiesto, las
 * presentaciones desactivadas desaparecen (y el producto, si no le queda ninguna) y cada una lleva
 * su estado de stock. Sin registros, la vitrina queda igual.
 */
export function applyInventory(storefront: Storefront, records: InventoryRecord[]): Storefront {
  if (!records.length) return storefront;
  const byKey = new Map(records.map((record) => [record.variantKey, record]));
  const products = storefront.products.flatMap((product) => {
    if (!product.formats.length) {
      const record = byKey.get(variantKey(product.key));
      if (!record) return [product];
      if (!record.active) return [];
      return [{ ...product, sku: record.sku ?? product.sku, price: record.price ?? product.price, stock: record.trackStock ? stockStatus(record) : product.stock ?? "untracked" }];
    }
    const formats = product.formats.flatMap((format) => {
      const record = byKey.get(variantKey(product.key, format.label));
      if (!record) return [format];
      if (!record.active) return [];
      return [{ ...format, sku: record.sku ?? format.sku, price: record.price ?? format.price, stock: record.trackStock ? stockStatus(record) : format.stock ?? "untracked" }];
    });
    return formats.length ? [{ ...product, formats }] : [];
  });
  return { ...storefront, products };
}

const optionalSku = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/, "SKU: letras, números, punto, guion o guion bajo (máx. 40).");

/** Cambios a una presentación desde el panel; `null` borra el SKU o el precio. */
export const variantUpdateSchema = z.object({
  variantKey: z.string().min(3).max(200),
  sku: optionalSku.nullable().optional(),
  price: z.number().int().positive().max(100_000_000).nullable().optional(),
  active: z.boolean().optional(),
  trackStock: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).max(100_000).optional(),
});
export type VariantUpdate = z.infer<typeof variantUpdateSchema>;

export const movementInputSchema = z.object({
  variantKey: z.string().min(3).max(200),
  kind: z.enum(movementKinds),
  /** Unidades movidas; en un conteo, el stock contado (puede ser 0). */
  quantity: z.number().int().min(0).max(1_000_000),
  note: z.string().trim().max(200).optional(),
});
export type MovementInput = z.infer<typeof movementInputSchema>;

/** Movimiento con signo a partir de lo que se ingresó; `undefined` si no cambia nada. */
export function movementDelta(input: Pick<MovementInput, "kind" | "quantity">, currentStock: number): { quantity: number; reason: MovementReason } | undefined {
  if (input.kind === "count") {
    const quantity = input.quantity - currentStock;
    return quantity === 0 ? undefined : { quantity, reason: "adjustment" };
  }
  if (input.quantity === 0) return undefined;
  const outgoing = input.kind === "waste" || input.kind === "sale";
  return { quantity: outgoing ? -input.quantity : input.quantity, reason: input.kind };
}

// --- Planilla (CSV) -------------------------------------------------------------------------------

const csvColumns = ["codigo", "producto", "presentacion", "sku", "precio", "stock", "activo"] as const;

function csvCell(value: string | number | undefined) {
  const text = value === undefined ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Planilla para Excel en español (separador `;`, con BOM para que respete los acentos). */
export function inventoryCsv(variants: CatalogVariant[], records: InventoryRecord[]) {
  const byKey = new Map(records.map((record) => [record.variantKey, record]));
  const rows = variants.map((variant) => {
    const record = byKey.get(variant.variantKey);
    return [variant.variantKey, variant.productName, variant.formatLabel, record?.sku ?? variant.sku, record?.price ?? variant.price, record?.trackStock ? record.stock : undefined, record && !record.active ? "no" : "si"].map(csvCell).join(";");
  });
  return `﻿${csvColumns.join(";")}\n${rows.join("\n")}\n`;
}

/** Lee CSV con `;` o `,` y comillas dobles. */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const separator = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((cells) => cells.some((value) => value.trim()));
}

const normalizeHeader = (value: string) => value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export interface ImportChange {
  variantKey: string;
  update: Omit<VariantUpdate, "variantKey">;
  /** Stock contado en la planilla (se registra como conteo físico). */
  countedStock?: number;
}

/**
 * Cambios a partir de la planilla. Identifica cada fila por `codigo` o, si falta, por SKU. Celdas
 * vacías no cambian nada; el stock se toma como conteo físico.
 */
export function planInventoryImport(text: string, variants: CatalogVariant[], records: InventoryRecord[]) {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error("La planilla está vacía.");
  const columns = header.map(normalizeHeader);
  const at = (name: string) => columns.indexOf(name);
  if (at("codigo") < 0 && at("sku") < 0) throw new Error("La planilla debe tener la columna codigo o sku (descarga la planilla del panel y complétala).");

  const known = new Map(variants.map((variant) => [variant.variantKey, variant]));
  const current = new Map(records.map((record) => [record.variantKey, record]));
  const bySku = new Map<string, string>();
  for (const variant of variants) if (variant.sku) bySku.set(variant.sku.toUpperCase(), variant.variantKey);
  for (const record of records) if (record.sku && known.has(record.variantKey)) bySku.set(record.sku.toUpperCase(), record.variantKey);

  const changes: ImportChange[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  rows.forEach((cells, index) => {
    const line = index + 2;
    const cell = (name: string) => (at(name) >= 0 ? cells[at(name)] ?? "" : "").trim();
    const code = cell("codigo");
    const sku = cell("sku");
    const key = code ? (known.has(code) ? code : undefined) : bySku.get(sku.toUpperCase());
    if (!key) { errors.push(`Fila ${line}: ${code ? `el código ${code} no está en el catálogo` : sku ? `el SKU ${sku} no está en el catálogo` : "sin código ni SKU"}.`); return; }
    if (seen.has(key)) { errors.push(`Fila ${line}: ${key} aparece más de una vez.`); return; }
    seen.add(key);

    const update: ImportChange["update"] = {};
    if (sku) {
      const parsed = optionalSku.safeParse(sku);
      if (!parsed.success) { errors.push(`Fila ${line}: SKU inválido (${sku}).`); return; }
      if (parsed.data !== (current.get(key)?.sku ?? known.get(key)?.sku)) update.sku = parsed.data;
    }
    const priceText = cell("precio");
    if (priceText) {
      const price = Number(priceText.replace(/[^\d]/g, ""));
      if (!Number.isInteger(price) || price <= 0 || price > 100_000_000) { errors.push(`Fila ${line}: precio inválido (${priceText}).`); return; }
      if (price !== (current.get(key)?.price ?? known.get(key)?.price)) update.price = price;
    }
    const activeText = normalizeHeader(cell("activo"));
    if (activeText) {
      if (!["si", "no", "1", "0"].includes(activeText)) { errors.push(`Fila ${line}: activo debe ser si o no.`); return; }
      const active = activeText === "si" || activeText === "1";
      if (active !== (current.get(key)?.active ?? true)) update.active = active;
    }
    const stockText = cell("stock");
    let countedStock: number | undefined;
    if (stockText) {
      countedStock = Number(stockText.replace(/[.\s]/g, ""));
      if (!Number.isInteger(countedStock) || countedStock < 0 || countedStock > 1_000_000) { errors.push(`Fila ${line}: stock inválido (${stockText}).`); return; }
      if (current.get(key)?.trackStock && current.get(key)?.stock === countedStock) countedStock = undefined;
    }
    if (Object.keys(update).length || countedStock !== undefined) changes.push({ variantKey: key, update, countedStock });
  });

  // Un SKU no puede quedar en dos presentaciones.
  const finalSku = new Map<string, string>();
  for (const record of records) if (record.sku) finalSku.set(record.variantKey, record.sku.toUpperCase());
  for (const change of changes) if (change.update.sku) finalSku.set(change.variantKey, change.update.sku.toUpperCase());
  const owners = new Map<string, string>();
  for (const [key, value] of finalSku) {
    if (owners.has(value)) errors.push(`El SKU ${value} quedaría en ${owners.get(value)} y en ${key}.`);
    owners.set(value, key);
  }
  return { changes, errors };
}
