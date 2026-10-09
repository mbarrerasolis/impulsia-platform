import "server-only";
import { fetchMetaAdInsights } from "@/integrations/meta/ads-insights";
import { getServerEnv } from "@/lib/env";
import { getMarketingRepository } from "@/repositories";
import { syncMetaAdSpend } from "@/services/marketing/sync-meta-ads";

/** La sincronización sólo corre con la cuenta publicitaria y el token de lectura configurados. */
export function isMetaAdsSyncConfigured() {
  const env = getServerEnv();
  return Boolean(env.META_AD_ACCOUNT_ID && env.META_ADS_ACCESS_TOKEN);
}

export async function runMetaAdsSync() {
  const env = getServerEnv();
  if (!env.META_AD_ACCOUNT_ID || !env.META_ADS_ACCESS_TOKEN) return null;
  const config = { adAccountId: env.META_AD_ACCOUNT_ID, accessToken: env.META_ADS_ACCESS_TOKEN, graphVersion: env.WHATSAPP_GRAPH_VERSION ?? "v26.0" };
  return syncMetaAdSpend({
    repository: getMarketingRepository(),
    fetchInsights: (range) => fetchMetaAdInsights(config, range),
    days: env.META_ADS_SYNC_DAYS,
  });
}
