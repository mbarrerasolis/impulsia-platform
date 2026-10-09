import { requireModule } from "@/lib/business";

/** Ventas de la tienda: sólo en ediciones con el módulo de tienda. */
export default function SalesModuleLayout({ children }: { children: React.ReactNode }) {
  requireModule("store");
  return children;
}
