import { requireModule } from "@/lib/business";

/** Reglas de precio del cotizador. */
export default function QuotesModuleLayout({ children }: { children: React.ReactNode }) {
  requireModule("quotes");
  return children;
}
