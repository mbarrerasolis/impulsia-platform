import { movementReasons, type InventoryRecord, type MovementReason, type VariantUpdate } from "@/domain/storefront/inventory";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { inventoryErrors, type InventoryRepository, type VariantIdentity } from "../inventory-repository";

function mapVariant(row: Tables<"product_variants">): InventoryRecord {
  return {
    variantKey: row.variant_key,
    productKey: row.product_key,
    productName: row.product_name,
    formatLabel: row.format_label,
    sku: row.sku ?? undefined,
    price: row.price ?? undefined,
    active: row.active,
    trackStock: row.track_stock,
    stock: row.stock,
    lowStockThreshold: row.low_stock_threshold,
    updatedAt: row.updated_at,
  };
}

/**
 * La vitrina es anónima: la lee el servidor con la clave elevada (a la página sólo llega el estado
 * del stock, no la cantidad). El panel lee y escribe con la sesión del equipo, bajo RLS; el stock
 * sólo cambia con la función record_inventory_movement.
 */
export class SupabaseInventoryRepository implements InventoryRepository {
  async listForStorefront() {
    const { data, error } = await createSupabaseAdminClient().from("product_variants").select("*").limit(5000);
    if (error) throw new Error(`No fue posible leer el inventario: ${error.message}`);
    return (data ?? []).map(mapVariant);
  }

  async list() {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("product_variants").select("*").order("product_name").limit(5000);
    if (error) throw new Error(`No fue posible leer el inventario: ${error.message}`);
    return (data ?? []).map(mapVariant);
  }

  async save(identity: VariantIdentity, update: Omit<VariantUpdate, "variantKey">) {
    const row: TablesInsert<"product_variants"> = {
      variant_key: identity.variantKey,
      product_key: identity.productKey,
      product_name: identity.productName,
      format_label: identity.formatLabel,
    };
    if (update.sku !== undefined) row.sku = update.sku;
    if (update.price !== undefined) row.price = update.price;
    if (update.active !== undefined) row.active = update.active;
    if (update.trackStock !== undefined) row.track_stock = update.trackStock;
    if (update.lowStockThreshold !== undefined) row.low_stock_threshold = update.lowStockThreshold;
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("product_variants").upsert(row, { onConflict: "variant_key" }).select("*").single();
    if (error?.code === "23505" && update.sku) throw new Error(inventoryErrors.duplicateSku(update.sku));
    if (error) throw new Error(`No fue posible guardar la presentación: ${error.message}`);
    return mapVariant(data);
  }

  async recordMovement(variantKey: string, quantity: number, reason: MovementReason, note?: string) {
    const client = await createSupabaseServerClient();
    const { data: variant, error: findError } = await client.from("product_variants").select("id, stock").eq("variant_key", variantKey).maybeSingle();
    if (findError) throw new Error(`No fue posible leer la presentación: ${findError.message}`);
    if (!variant) throw new Error(inventoryErrors.notFound);
    const { data, error } = await client.rpc("record_inventory_movement", { p_variant_id: variant.id, p_quantity: quantity, p_reason: reason, p_note: note ?? null });
    if (error?.message.includes("inventory_insufficient_stock")) throw new Error(inventoryErrors.negative(variant.stock));
    if (error) throw new Error(`No fue posible registrar el movimiento: ${error.message}`);
    return data;
  }

  async recentMovements(limit: number) {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("inventory_movements")
      .select("id, created_at, quantity, reason, note, stock_after, product_variants(variant_key, product_name, format_label)")
      .order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(`No fue posible leer los movimientos: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      variantKey: row.product_variants?.variant_key ?? "",
      productName: row.product_variants?.product_name ?? "—",
      formatLabel: row.product_variants?.format_label ?? "",
      quantity: row.quantity,
      reason: (movementReasons as readonly string[]).includes(row.reason) ? row.reason as MovementReason : "adjustment",
      note: row.note ?? undefined,
      stockAfter: row.stock_after,
      createdAt: row.created_at,
    }));
  }
}
