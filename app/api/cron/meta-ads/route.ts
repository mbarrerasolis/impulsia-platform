import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { runMetaAdsSync } from "@/lib/marketing/meta-ads-sync";

/** Tarea diaria de Vercel Cron: importa el gasto de Meta Ads. Vercel manda `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(request: Request) {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const result = await runMetaAdsSync();
    if (!result) return NextResponse.json({ skipped: "Meta Ads no está configurado." });
    console.info("marketing.meta_ads.synced", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("marketing.meta_ads.sync_failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No fue posible sincronizar Meta Ads." }, { status: 502 });
  }
}
