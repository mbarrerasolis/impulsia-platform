import { formatPricing, formatPrice, tierPrices, type Storefront, type StoreProduct } from "@/domain/config/storefront";
import { priceLines } from "./pricing";

/**
 * Lo que el asistente de la tienda puede consultar del catálogo: búsqueda de productos con precio,
 * tramo y stock, y cotización de un pedido con los tramos aplicados. Todo sale del catálogo vigente
 * (manifiesto + inventario); el asistente nunca calcula precios por su cuenta.
 */

const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
/** Plurales simples ("almendras" → "almendra", "nueces" → "nuez"). */
const stem = (word: string) => word.replace(/ces$/, "z").replace(/(es|s)$/, "");
const tokens = (text: string) => normalize(text).split(/[^a-z0-9]+/).filter((word) => word.length > 1).map(stem);

const soldOut = (product: StoreProduct) => product.formats.length ? product.formats.every((format) => format.stock === "out") : product.stock === "out";

/** Productos que mejor calzan con la consulta (nombre pesa más que categoría o descripción). */
export function searchProducts(storefront: Pick<Storefront, "products" | "categories">, query: string, limit = 8) {
  const wanted = tokens(query);
  if (!wanted.length) return [];
  const categoryName = new Map(storefront.categories.map((category) => [category.key, category.name]));
  return storefront.products
    .map((product, index) => {
      const name = new Set(tokens(product.name));
      const rest = new Set(tokens(`${categoryName.get(product.category) ?? ""} ${product.tags.join(" ")} ${product.description ?? ""}`));
      let score = 0;
      for (const word of wanted) {
        if (name.has(word)) score += 3;
        else if ([...name].some((item) => item.startsWith(word) || word.startsWith(item))) score += 2;
        else if (rest.has(word)) score += 1;
      }
      return { product, score, index };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(soldOut(a.product)) - Number(soldOut(b.product)) || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.product);
}

/** Ficha breve para el asistente: presentaciones con precio, tramo y stock. */
export function describeForAssistant(storefront: Pick<Storefront, "pricing" | "categories">, product: StoreProduct, money: (amount: number) => string, siteUrl?: string) {
  const rules = storefront.pricing;
  const tiers = tierPrices(product, rules);
  const formats = (product.formats.length ? product.formats : [undefined]).map((format) => {
    const price = formatPrice(product, format, rules);
    return {
      presentacion: format?.label ?? product.unit ?? "unidad",
      precio_con_iva: price ? money(price) : "a consultar",
      stock: (format ? format.stock : product.stock) === "out" ? "sin stock" : (format ? format.stock : product.stock) === "low" ? "últimas unidades" : "disponible",
    };
  });
  return {
    clave: product.key,
    nombre: product.name,
    categoria: storefront.categories.find((category) => category.key === product.category)?.name,
    descripcion: product.description,
    ...(product.sku ? { codigo: product.sku } : {}),
    venta: product.unit ? `por unidad (${product.unit})` : "por kilo",
    presentaciones: formats,
    ...(tiers ? { precio_por_volumen: tiers.bulk ? `${money(tiers.bulk)} ${product.unit ? "c/u" : "el kg"} desde ${rules.bulkFrom} ${product.unit ? "unidades" : "kg"} del mismo producto (en vez de ${money(tiers.base)})` : "sin precio por volumen" } : {}),
    ...(product.net ? { mayorista_neto: `${money(product.net.base)} + IVA ${product.unit ? "c/u" : "el kg"}${product.net.bulk && product.net.bulk < product.net.base ? `; ${money(product.net.bulk)} + IVA desde ${rules.bulkFrom}` : ""}` } : {}),
    ...(siteUrl ? { enlace: new URL(`/productos/${product.key}`, siteUrl).toString() } : {}),
  };
}

export interface OrderItemRequest {
  clave: string;
  presentacion?: string;
  cantidad: number;
}

/** Cotiza un pedido: valida productos, presentaciones y stock, y aplica el tramo por producto. */
export function quoteOrder(storefront: Pick<Storefront, "products" | "pricing">, items: OrderItemRequest[]) {
  const problems: string[] = [];
  const lines = items.flatMap((item) => {
    const product = storefront.products.find((candidate) => candidate.key === item.clave);
    if (!product) { problems.push(`No existe el producto "${item.clave}"; búscalo con buscar_productos.`); return []; }
    const format = product.formats.length
      ? product.formats.find((candidate) => normalize(candidate.label).replace(/\s/g, "") === normalize(item.presentacion ?? "").replace(/\s/g, "")) ?? (item.presentacion ? undefined : product.formats.at(-1))
      : undefined;
    if (product.formats.length && !format) { problems.push(`${product.name} se vende en ${product.formats.map((candidate) => candidate.label).join(" o ")}.`); return []; }
    if ((format ? format.stock : product.stock) === "out") { problems.push(`${product.name}${format ? ` ${format.label}` : ""} está sin stock.`); return []; }
    const price = formatPrice(product, format, storefront.pricing);
    return [{ id: `${product.key}::${format?.label ?? ""}`, name: product.name, format: format?.label ?? product.unit, sku: product.sku, quantity: Math.max(1, Math.round(item.cantidad)), price, pricing: formatPricing(product, format) }];
  });
  const priced = priceLines(lines, storefront.pricing);
  const complete = priced.length > 0 && priced.every((line) => line.price);
  const total = complete ? priced.reduce((sum, line) => sum + line.price! * line.quantity, 0) : undefined;
  return { lines: priced, total, problems };
}

/** Texto del pedido para el CRM y el equipo. */
export function orderSummary(lines: ReturnType<typeof quoteOrder>["lines"], money: (amount: number) => string, total?: number) {
  const rows = lines.map((line) => `• ${line.quantity} × ${line.name}${line.format ? ` (${line.format})` : ""}${line.sku ? ` [${line.sku}]` : ""}${line.price ? ` — ${money(line.price * line.quantity)}` : " — precio a confirmar"}`);
  return `${rows.join("\n")}${total ? `\nTotal productos: ${money(total)} IVA incluido (sin despacho)` : ""}`;
}
