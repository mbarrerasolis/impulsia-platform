import { requireModule } from "@/lib/business";

/** Reseñas de la tienda: sólo en ediciones con el módulo de tienda. */
export default function ReviewsModuleLayout({ children }: { children: React.ReactNode }) {
  requireModule("store");
  return children;
}
