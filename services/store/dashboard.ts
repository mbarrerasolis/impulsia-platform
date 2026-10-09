import "server-only";
import { catalogVariants, stockStatus } from "@/domain/storefront/inventory";
import { getServerEnv } from "@/lib/env";
import { getStorefront } from "@/lib/storefront";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInventoryRepository, getLeadRepository, getReviewRepository } from "@/repositories";

const dayMs = 24 * 60 * 60 * 1000;

/** Indicadores de tienda para el dashboard: pedidos, stock, reseñas y conversaciones por atender. */
export async function getStoreDashboard(now = new Date()) {
  const storefront = getStorefront();
  const inStore = new Set(storefront ? catalogVariants(storefront).map((variant) => variant.variantKey) : []);
  const waitingConversations = async () => {
    if (getServerEnv().APP_MODE !== "supabase") return 0;
    const client = await createSupabaseServerClient();
    const { count, error } = await client.from("conversations").select("id", { count: "exact", head: true }).eq("status", "waiting_human");
    if (error) throw new Error(`No fue posible contar conversaciones: ${error.message}`);
    return count ?? 0;
  };
  const leads = getLeadRepository();
  const [ordersToday, ordersWeek, records, pendingReviews, waiting] = await Promise.all([
    leads.countStoreOrdersSince(new Date(now.getTime() - dayMs).toISOString()),
    leads.countStoreOrdersSince(new Date(now.getTime() - 7 * dayMs).toISOString()),
    getInventoryRepository().list(),
    getReviewRepository().list("pending", 100),
    waitingConversations(),
  ]);
  const selling = records.filter((record) => record.active && inStore.has(record.variantKey));
  return {
    ordersToday,
    ordersWeek,
    lowStock: selling.filter((record) => stockStatus(record) === "low").length,
    outOfStock: selling.filter((record) => stockStatus(record) === "out").length,
    pendingReviews: pendingReviews.length,
    waitingConversations: waiting,
  };
}
