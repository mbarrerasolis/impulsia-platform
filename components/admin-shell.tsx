import Link from "next/link";
import {
  BarChart3,
  Blocks,
  Building2,
  Calculator,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PlugZap,
  Settings,
  UsersRound,
  Star,
  Boxes,
  ShoppingCart,
} from "lucide-react";
import type { Route } from "next";
import type { ModuleKey } from "@/domain/config/business";
import { getBrandConfig } from "@/lib/brand";
import { getVocabulary, isModuleEnabled } from "@/lib/business";
import { AdminNavLink } from "./admin-nav-link";
import { Brand } from "./brand";
import { LogoutButton } from "./logout-button";

type NavItem = { href: Route; label: string; icon: typeof LayoutDashboard; section?: string; module?: ModuleKey };

/** Menú de operación; cada ítem con `module` sólo aparece si la edición lo tiene activo. */
function operationLinks(accountsLabel: string): NavItem[] {
  return [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/crm", label: "CRM", icon: UsersRound },
    { href: "/admin/marketing", label: "Campañas y gastos", icon: Megaphone },
    { href: "/admin/accounts", label: accountsLabel, icon: Building2 },
    { href: "/admin/quotes/new", label: "Cotizador", icon: Calculator, section: "/admin/quotes", module: "quotes" },
    { href: "/admin/solutions", label: "Soluciones", icon: Blocks, module: "subscriptions" },
    { href: "/admin/billing", label: "Cobranza", icon: CreditCard, module: "subscriptions" },
    { href: "/admin/conversations", label: "Conversaciones", icon: MessageSquare, module: "whatsapp" },
    { href: "/admin/sales", label: "Ventas", icon: ShoppingCart, module: "store" },
    { href: "/admin/inventory", label: "Inventario", icon: Boxes, module: "store" },
    { href: "/admin/reviews", label: "Reseñas", icon: Star, module: "store" },
    { href: "/admin/integrations", label: "Integraciones", icon: PlugZap },
  ];
}

const configurationLinks: NavItem[] = [
  { href: "/admin/pricing", label: "Reglas de precio", icon: BarChart3, module: "quotes" },
  { href: "/admin/settings", label: "Ajustes", icon: Settings },
];

const visible = (item: NavItem) => !item.module || isModuleEnabled(item.module);

export function AdminShell({
  children,
  dataMode,
}: {
  children: React.ReactNode;
  dataMode: "demo" | "supabase";
}) {
  const brand = getBrandConfig();
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link href="/" aria-label={`Ir al sitio público de ${brand.name}`}><Brand name={brand.name} /></Link>
        <div className="side-group">
          <div className="side-label">Operación</div>
          {operationLinks(getVocabulary().accounts).filter(visible).map(({ href, label, icon: Icon, section }) => (
            <AdminNavLink href={href} section={section} key={href}><Icon size={18} /><span>{label}</span></AdminNavLink>
          ))}
        </div>
        <div className="side-group">
          <div className="side-label">Configuración</div>
          {configurationLinks.filter(visible).map(({ href, label, icon: Icon }) => (
            <AdminNavLink href={href} key={href}><Icon size={18} /><span>{label}</span></AdminNavLink>
          ))}
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <strong>Operación comercial</strong>{" "}
            <span className={`demo-badge ${dataMode === "supabase" ? "live-data-badge" : ""}`}>
              {dataMode === "supabase" ? "DATOS REALES" : "DATOS DEMO"}
            </span>
          </div>
          <div className="admin-user">
            <span className="avatar" style={{ width: 33, height: 33, borderRadius: "50%" }}>CA</span>
            <span>Owner Admin</span>
            {dataMode === "supabase" && <LogoutButton />}
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
