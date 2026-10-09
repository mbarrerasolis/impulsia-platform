import { NextResponse } from "next/server";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { runMetaAdsSync } from "@/lib/marketing/meta-ads-sync";

/** "Sincronizar con Meta" desde Campañas y gastos: misma importación que la tarea diaria. */
export async function POST() {
  try {
    await requireInternalApiRole(["owner_admin", "sales", "finance"]);
    const result = await runMetaAdsSync();
    if (!result) return NextResponse.json({ error: "Falta configurar la cuenta publicitaria o el token de Meta Ads." }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Meta Ads respondió")) {
      console.error("marketing.meta_ads.sync_failed", { message: error.message });
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return routeError(error, "marketing.meta_ads.sync_failed");
  }
}
