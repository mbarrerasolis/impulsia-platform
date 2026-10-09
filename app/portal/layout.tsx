import { requireModule } from "@/lib/business";

/** Portal de clientes de soluciones. */
export default function ClientPortalModuleLayout({ children }: { children: React.ReactNode }) {
  requireModule("clientPortal");
  return children;
}
