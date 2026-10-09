import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const internalRoles = ["owner_admin", "sales", "technical", "finance", "support"] as const;
export const clientRoles = ["client_admin", "client_billing", "client_technical", "client_viewer"] as const;
export type AppRole = (typeof internalRoles)[number] | (typeof clientRoles)[number];

export async function requireRole(allowed: readonly AppRole[]) {
  if (getServerEnv().APP_MODE === "demo") {
    return { id: "demo-owner", role: "owner_admin" as const, accountId: null };
  }
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await client.from("profiles").select("role, account_id").eq("id", user.id).single();
  if (!profile || !allowed.includes(profile.role)) redirect("/unauthorized");
  return { id: user.id, role: profile.role, accountId: profile.account_id };
}
