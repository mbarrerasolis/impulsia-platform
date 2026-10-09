/**
 * Precios por tramo de la lista mayorista: cada producto tiene un precio NETO por kilo (o por unidad)
 * para el tramo base y otro por volumen. El tramo se decide por producto, sumando lo que hay en el
 * carro de ese producto (p. ej. 2 bolsas de 1 kg + 4 de 1 kg = 6 kg → precio por volumen). Al
 * público se le muestra el precio con impuesto, redondeado.
 */

export interface PriceRules {
  /** Impuesto que se suma al neto (0.19 = IVA en Chile). */
  taxRate: number;
  /** Desde cuántos kilos (o unidades) de un mismo producto rige el precio por volumen. */
  bulkFrom: number;
  /** Redondeo del precio final (10 = a la decena). */
  roundTo: number;
}

export const defaultPriceRules: PriceRules = { taxRate: 0.19, bulkFrom: 6, roundTo: 10 };

/** Precio de lista de una presentación: neto por kilo/unidad y cuántos kilos/unidades trae. */
export interface LinePricing {
  productKey: string;
  /** Kilos por presentación (0,5 para 500 g) o 1 si se vende por unidad. */
  size: number;
  base: number;
  bulk?: number;
  /** Se vende por unidad (bolsa, frasco): el tramo cuenta unidades. */
  perUnit?: boolean;
}

export function grossPrice(net: number, size: number, rules: PriceRules) {
  return Math.round((net * size * (1 + rules.taxRate)) / rules.roundTo) * rules.roundTo;
}

/** Neto que corresponde a una cantidad total del producto. */
export function tierNet(pricing: Pick<LinePricing, "base" | "bulk">, totalSize: number, rules: PriceRules) {
  return pricing.bulk && totalSize >= rules.bulkFrom - 1e-9 ? pricing.bulk : pricing.base;
}

interface PricedProduct {
  key: string;
  unit?: string;
  net?: { base: number; bulk?: number };
}

/** Precio de lista de un producto en una presentación (`grams`); `undefined` si no tiene lista. */
export function productPricing(product: PricedProduct, grams?: number): LinePricing | undefined {
  if (!product.net) return undefined;
  const size = product.unit ? 1 : (grams ?? 1000) / 1000;
  return { productKey: product.key, size, base: product.net.base, bulk: product.net.bulk, ...(product.unit ? { perUnit: true } : {}) };
}

interface PricedLine {
  id: string;
  quantity: number;
  price?: number;
  pricing?: LinePricing;
}

/** Precio unitario de cada línea del carro aplicando el tramo por producto. */
export function priceLines<T extends PricedLine>(lines: T[], rules: PriceRules): T[] {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (line.pricing && line.quantity > 0) totals.set(line.pricing.productKey, (totals.get(line.pricing.productKey) ?? 0) + line.pricing.size * line.quantity);
  }
  return lines.map((line) => {
    if (!line.pricing) return line;
    const net = tierNet(line.pricing, totals.get(line.pricing.productKey) ?? 0, rules);
    return { ...line, price: grossPrice(net, line.pricing.size, rules) };
  });
}

/** Cuánto falta de un producto para el precio por volumen; `undefined` si no tiene o ya lo alcanzó. */
export function missingForBulk(pricing: LinePricing, totalSize: number, rules: PriceRules) {
  if (!pricing.bulk || pricing.bulk >= pricing.base) return undefined;
  const missing = rules.bulkFrom - totalSize;
  return missing > 1e-9 ? missing : undefined;
}
