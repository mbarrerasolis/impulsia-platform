import { requireModule } from "@/lib/business";

/** Soluciones contratadas: requiere el módulo de soluciones y cobranza. */
export default function SubscriptionsModuleLayout({ children }: { children: React.ReactNode }) {
  requireModule("subscriptions");
  return children;
}
