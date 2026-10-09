import "server-only";
import { getServerEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { internalRoles, type AppRole } from "./authorization";

export class ApiAuthorizationError extends Error {
  constructor(message: string, readonly status: 401 | 403) { super(message); }
}

export async function requireInternalApiRole(allowed: readonly AppRole[] = internalRoles) {
  if (getServerEnv().APP_MODE === "demo") return { id:"demo-owner", role:"owner_admin" as const };
  const client=await createSupabaseServerClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user) throw new ApiAuthorizationError("Debes iniciar sesión.",401);
  const {data:profile}=await client.from("profiles").select("role").eq("id",user.id).single();
  if(!profile||!allowed.includes(profile.role)) throw new ApiAuthorizationError("No tienes permisos para esta acción.",403);
  return {id:user.id,role:profile.role};
}
