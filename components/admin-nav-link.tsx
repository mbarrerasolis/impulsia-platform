"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Enlace del menú lateral; se marca activo cuando la página actual está bajo su sección. */
export function AdminNavLink({ href, section, children }: { href: Route; section?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = section ?? href;
  const active = pathname === base || pathname.startsWith(`${base}/`);
  return <Link href={href} className={`side-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>{children}</Link>;
}
