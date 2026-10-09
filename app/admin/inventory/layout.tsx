import { requireModule } from "@/lib/business";

/** Inventario de la tienda: sólo en ediciones con el módulo de tienda. */
export default function InventoryModuleLayout({ children }: { children: React.ReactNode }) {
  requireModule("store");
  return children;
}
