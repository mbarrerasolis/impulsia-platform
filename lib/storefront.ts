import "server-only";
import activeEdition from "@/config/edition.json";
import { parseStorefront, type Storefront } from "@/domain/config/storefront";
import { isModuleEnabled } from "@/lib/business";

let cached: Storefront | null | undefined;

/** Vitrina de la edición activa; `null` si la edición no vende productos o no la declara. */
export function getStorefront(): Storefront | null {
  if (cached !== undefined) return cached;
  const source = (activeEdition as { storefront?: unknown }).storefront;
  cached = source && isModuleEnabled("store") ? parseStorefront(source) : null;
  return cached;
}
