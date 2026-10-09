import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Cliente elevado separado del cliente SSR. Nunca hereda cookies de usuario.
 * Sólo debe usarse después de una autorización explícita en una ruta o job server-side.
 */
export function createSupabaseAdminClient() {
  const env=getServerEnv();
  const secret=env.SUPABASE_SECRET_KEY??env.SUPABASE_SERVICE_ROLE_KEY;
  if(!env.NEXT_PUBLIC_SUPABASE_URL||!secret){
    throw new Error("La operación elevada requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY.");
  }
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL,secret,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:{"X-Client-Info":"impulsia-server-admin"}}
  });
}
