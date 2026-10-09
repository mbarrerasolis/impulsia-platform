import "server-only";
import { catalogVariants } from "@/domain/storefront/inventory";
import type { SaleLine } from "@/domain/storefront/sales";
import { getEditionConfig } from "@/lib/edition";
import { formatMoney } from "@/lib/format";
import { getStorefront } from "@/lib/storefront";
import { getInventoryRepository, getSaleRepository } from "@/repositories";
import { storefrontWithInventory } from "./inventory";
import type { SalesDeps } from "./sales";

export function editionMoney() {
  const edition = getEditionConfig();
  return (amount: number) => formatMoney(amount, edition.pricing.currency, edition.locale);
}

/** Descuenta del inventario las presentaciones con control de stock; las demás no se tocan. */
async function discountStock(lines: SaleLine[], reference: string) {
  const repository = getInventoryRepository();
  const records = new Map((await repository.list()).map((record) => [record.variantKey, record]));
  const warnings: string[] = [];
  for (const line of lines) {
    if (!records.get(line.id)?.trackStock) continue;
    try {
      await repository.recordMovement(line.id, -line.quantity, "sale", `Venta ${reference}`);
    } catch (error) {
      warnings.push(`${line.name}${line.format ? ` ${line.format}` : ""}: ${error instanceof Error ? error.message : "no se pudo descontar el stock"}`);
    }
  }
  return warnings;
}

/** Dependencias reales: catálogo con inventario al día, repositorio según el modo y moneda de la edición. */
export async function salesDeps(options: { withStock?: boolean } = {}): Promise<SalesDeps> {
  const manifest = getStorefront();
  if (!manifest) throw new Error("Esta edición no tiene tienda.");
  return {
    repository: getSaleRepository(),
    storefront: await storefrontWithInventory(manifest),
    money: editionMoney(),
    ...(options.withStock ? { discountStock } : {}),
  };
}

/** Presentaciones a la venta para el editor de cotizaciones del panel (con precio vigente). */
export async function saleCatalogOptions() {
  const manifest = getStorefront();
  if (!manifest) return [];
  const storefront = await storefrontWithInventory(manifest);
  const money = editionMoney();
  return catalogVariants(storefront).map((variant) => {
    const price = variant.price ?? variant.listPrice;
    return { variantKey: variant.variantKey, label: `${variant.productName}${variant.formatLabel ? ` · ${variant.formatLabel}` : ""} — ${price ? money(price) : "sin precio"}` };
  });
}
