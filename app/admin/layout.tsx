import type { Metadata } from "next";
import { internalRoles, requireRole } from "@/lib/auth/authorization";
import { AdminShell } from "@/components/admin-shell";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({children}:{children:React.ReactNode}) {
  await requireRole(internalRoles);
  return <AdminShell dataMode={getServerEnv().APP_MODE}>{children}</AdminShell>;
}
