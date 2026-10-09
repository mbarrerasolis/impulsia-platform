import type { InventoryMovement, InventoryRecord, MovementReason, VariantUpdate } from "@/domain/storefront/inventory";
import { inventoryErrors, type InventoryRepository, type VariantIdentity } from "../inventory-repository";

/** Modo demo: inventario en memoria del proceso, compartido entre rutas y páginas vía globalThis. */
const globalForDemo = globalThis as unknown as { impulsiaDemoInventory?: { records: InventoryRecord[]; movements: InventoryMovement[] } };
const store = globalForDemo.impulsiaDemoInventory ??= { records: [], movements: [] };

export class MemoryInventoryRepository implements InventoryRepository {
  async listForStorefront() {
    return store.records.map((record) => ({ ...record }));
  }

  async list() {
    return this.listForStorefront();
  }

  async save(identity: VariantIdentity, update: Omit<VariantUpdate, "variantKey">) {
    const sku = update.sku?.toUpperCase();
    if (sku && store.records.some((record) => record.variantKey !== identity.variantKey && record.sku?.toUpperCase() === sku)) throw new Error(inventoryErrors.duplicateSku(update.sku!));
    let record = store.records.find((item) => item.variantKey === identity.variantKey);
    if (!record) {
      record = { ...identity, active: true, trackStock: false, stock: 0, lowStockThreshold: 5 };
      store.records.push(record);
    }
    record.productName = identity.productName;
    if (update.sku !== undefined) record.sku = update.sku ?? undefined;
    if (update.price !== undefined) record.price = update.price ?? undefined;
    if (update.active !== undefined) record.active = update.active;
    if (update.trackStock !== undefined) record.trackStock = update.trackStock;
    if (update.lowStockThreshold !== undefined) record.lowStockThreshold = update.lowStockThreshold;
    record.updatedAt = new Date().toISOString();
    return { ...record };
  }

  async recordMovement(variantKey: string, quantity: number, reason: MovementReason, note?: string) {
    const record = store.records.find((item) => item.variantKey === variantKey);
    if (!record) throw new Error(inventoryErrors.notFound);
    if (record.stock + quantity < 0) throw new Error(inventoryErrors.negative(record.stock));
    record.stock += quantity;
    record.trackStock = true;
    store.movements.push({ id: crypto.randomUUID(), variantKey, productName: record.productName, formatLabel: record.formatLabel, quantity, reason, note: note || undefined, stockAfter: record.stock, createdAt: new Date().toISOString() });
    return record.stock;
  }

  async recentMovements(limit: number) {
    return store.movements.slice(-limit).reverse();
  }
}
