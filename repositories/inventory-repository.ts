import type { InventoryMovement, InventoryRecord, MovementReason, VariantUpdate } from "@/domain/storefront/inventory";

/** Presentación del catálogo a la que se le guardan datos comerciales. */
export type VariantIdentity = Pick<InventoryRecord, "variantKey" | "productKey" | "productName" | "formatLabel">;

export interface InventoryRepository {
  /** Para la vitrina pública: la lee el servidor sin sesión. */
  listForStorefront(): Promise<InventoryRecord[]>;
  /** Para el panel, con la sesión del equipo. */
  list(): Promise<InventoryRecord[]>;
  /** Crea la presentación si no existe y aplica los cambios (nunca toca el stock). */
  save(identity: VariantIdentity, update: Omit<VariantUpdate, "variantKey">): Promise<InventoryRecord>;
  /** Suma o resta stock dejando el movimiento; devuelve el saldo. */
  recordMovement(variantKey: string, quantity: number, reason: MovementReason, note?: string): Promise<number>;
  recentMovements(limit: number): Promise<InventoryMovement[]>;
}

/** Mensajes compartidos por los adaptadores (el panel los muestra tal cual). */
export const inventoryErrors = {
  notFound: "Presentación no encontrada en el inventario.",
  negative: (stock: number) => `El stock no admite quedar bajo cero: hay ${stock} ${stock === 1 ? "unidad" : "unidades"}.`,
  duplicateSku: (sku: string) => `El SKU ${sku} ya fue asignado a otra presentación.`,
};
