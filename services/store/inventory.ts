import "server-only";
import type { Storefront } from "@/domain/config/storefront";
import { applyInventory, catalogVariants, movementDelta, planInventoryImport, type InventoryRecord, type MovementInput, type VariantUpdate } from "@/domain/storefront/inventory";
import { getStorefront } from "@/lib/storefront";
import { getInventoryRepository } from "@/repositories";
import { inventoryErrors, type VariantIdentity } from "@/repositories/inventory-repository";

/**
 * De dónde saca la vitrina precios y stock. Hoy `local` (las tablas de la tienda); en la fase E se
 * agrega el adaptador `erp` (FrutoFlow), que pasa a ser la fuente de verdad.
 */
export interface InventoryProvider {
  readonly source: "local" | "erp";
  catalogRecords(): Promise<InventoryRecord[]>;
}

const localProvider: InventoryProvider = {
  source: "local",
  catalogRecords: () => getInventoryRepository().listForStorefront(),
};

export function getInventoryProvider(): InventoryProvider {
  return localProvider;
}

/** Vitrina con precios y stock al día; si el inventario falla, la del manifiesto. */
export async function storefrontWithInventory(storefront: Storefront) {
  try {
    return applyInventory(storefront, await getInventoryProvider().catalogRecords());
  } catch (error) {
    console.error("store.inventory.load_failed", { message: error instanceof Error ? error.message : "unknown" });
    return storefront;
  }
}

function requireCatalog() {
  const storefront = getStorefront();
  if (!storefront) throw new Error("Esta edición no admite inventario: no tiene tienda.");
  return catalogVariants(storefront);
}

function identityFor(variantKey: string): VariantIdentity {
  const variant = requireCatalog().find((item) => item.variantKey === variantKey);
  if (!variant) throw new Error(inventoryErrors.notFound);
  return { variantKey: variant.variantKey, productKey: variant.productKey, productName: variant.productName, formatLabel: variant.formatLabel };
}

export async function updateVariant({ variantKey, ...update }: VariantUpdate) {
  return getInventoryRepository().save(identityFor(variantKey), update);
}

/** Registra un movimiento del panel; un conteo se guarda como ajuste por la diferencia. */
export async function moveStock(input: MovementInput) {
  const identity = identityFor(input.variantKey);
  const repository = getInventoryRepository();
  const current = (await repository.list()).find((record) => record.variantKey === input.variantKey);
  const delta = movementDelta(input, current?.stock ?? 0);
  if (!delta) {
    // Contar lo mismo que hay (p. ej. 0) igual deja la presentación con control de stock.
    if (input.kind === "count" && !current?.trackStock) await repository.save(identity, { trackStock: true });
    return current?.stock ?? 0;
  }
  if (!current) await repository.save(identity, {});
  return repository.recordMovement(input.variantKey, delta.quantity, delta.reason, input.note);
}

/** Aplica la planilla completa o nada: con cualquier error no cambia ninguna fila. */
export async function importInventory(text: string) {
  const variants = requireCatalog();
  const repository = getInventoryRepository();
  const records = await repository.list();
  const { changes, errors } = planInventoryImport(text, variants, records);
  if (errors.length) return { updated: 0, movements: 0, errors };

  const byKey = new Map(records.map((record) => [record.variantKey, record]));
  let movements = 0;
  for (const change of changes) {
    const current = byKey.get(change.variantKey);
    const counted = change.countedStock !== undefined;
    await repository.save(identityFor(change.variantKey), counted ? { ...change.update, trackStock: true } : change.update);
    const quantity = counted ? change.countedStock! - (current?.stock ?? 0) : 0;
    if (quantity !== 0) {
      await repository.recordMovement(change.variantKey, quantity, "adjustment", "Conteo cargado por planilla");
      movements++;
    }
  }
  return { updated: changes.length, movements, errors: [] as string[] };
}
