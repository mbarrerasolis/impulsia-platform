import { requireSectorLanding } from "@/lib/business";

/** Landing del sector salud: propia de las ediciones que la declaran en `modules.sectorLandings`. */
export default function SaludLayout({ children }: { children: React.ReactNode }) {
  requireSectorLanding("salud");
  return children;
}
