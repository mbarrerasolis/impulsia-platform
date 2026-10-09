/**
 * Lectura del gasto de Meta Ads (API de Marketing, permiso `ads_read`): gasto, impresiones y clics por
 * campaña, día y ubicación (Instagram, Facebook…). Sólo lectura: nunca crea ni modifica anuncios.
 */
export interface MetaAdsConfig {
  /** Id numérico de la cuenta publicitaria, sin el prefijo `act_`. */
  adAccountId: string;
  accessToken: string;
  graphVersion: string;
}

const fields = ["campaign_id", "campaign_name", "spend", "impressions", "clicks", "account_currency"].join(",");

export async function fetchMetaAdInsights(
  config: MetaAdsConfig,
  range: { since: string; until: string },
  fetchImpl: typeof fetch = fetch,
): Promise<unknown[]> {
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/act_${config.adAccountId}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("breakdowns", "publisher_platform");
  url.searchParams.set("fields", fields);
  url.searchParams.set("time_range", JSON.stringify(range));
  url.searchParams.set("limit", "500");

  const rows: unknown[] = [];
  let next: string | undefined = url.toString();
  // Meta pagina con `paging.next`; el tope evita un bucle si la respuesta viniera mal formada.
  for (let page = 0; next && page < 20; page += 1) {
    const response = await fetchImpl(next, { headers: { authorization: `Bearer ${config.accessToken}` }, signal: AbortSignal.timeout(15_000) });
    const body = await response.json().catch(() => ({})) as { data?: unknown[]; paging?: { next?: string }; error?: { message?: string; code?: number } };
    if (!response.ok) throw new Error(`Meta Ads respondió ${response.status}${body.error?.code ? ` (código ${body.error.code})` : ""}: ${body.error?.message?.slice(0, 200) ?? "sin detalle"}`);
    rows.push(...(body.data ?? []));
    next = body.paging?.next;
  }
  return rows;
}
