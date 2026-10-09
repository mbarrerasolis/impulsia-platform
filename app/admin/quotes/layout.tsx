import { requireModule } from "@/lib/business";

/** Cotizador: sólo en ediciones que venden servicios por jornadas. */
export default function QuotesModuleLayout({ children }: { children: React.ReactNode }) {
  requireModule("quotes");
  return children;
}
