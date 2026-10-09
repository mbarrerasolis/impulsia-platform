import { requireModule } from "@/lib/business";

/** Cobranza de mantenciones. */
export default function SubscriptionsModuleLayout({ children }: { children: React.ReactNode }) {
  requireModule("subscriptions");
  return children;
}
