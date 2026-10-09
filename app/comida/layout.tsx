import { requireSectorLanding } from "@/lib/business";

/** Landing de comida rápida: propia de las ediciones que la declaran en `modules.sectorLandings`. */
export default function ComidaLayout({ children }: { children: React.ReactNode }) {
  requireSectorLanding("comida");
  return children;
}
