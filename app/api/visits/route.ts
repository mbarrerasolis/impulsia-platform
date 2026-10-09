import { NextResponse } from "next/server";
import { z } from "zod";
import { parseLeadAttribution } from "@/domain/marketing/attribution";
import { isPrivatePath } from "@/lib/public-paths";
import { getMarketingRepository } from "@/repositories";

const visitSchema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  landingPath: z.string().startsWith("/").max(300).optional(),
  attribution: z.unknown().optional(),
});

/** Agentes que no son personas (buscadores, vistas previas de enlaces, monitoreo). */
const botAgent = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|pingdom|uptime|curl|wget|python|node-fetch|axios/i;

/**
 * Cuenta una sesión del sitio público, anónima: no guarda IP, navegador ni cookies; sólo el origen
 * (UTM o sitio de referencia) para medir la conversión visita → lead. Siempre responde 204.
 */
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 4_000) return new NextResponse(null, { status: 204 });
    if (botAgent.test(request.headers.get("user-agent") ?? "bot")) return new NextResponse(null, { status: 204 });
    const parsed = visitSchema.safeParse(JSON.parse(await request.text()));
    if (!parsed.success || (parsed.data.landingPath && isPrivatePath(parsed.data.landingPath))) return new NextResponse(null, { status: 204 });
    await getMarketingRepository().recordVisit({
      sessionId: parsed.data.sessionId,
      landingPath: parsed.data.landingPath,
      attribution: parseLeadAttribution(parsed.data.attribution),
    });
  } catch (error) {
    console.error("visit.record.failed", { message: error instanceof Error ? error.message : "unknown" });
  }
  return new NextResponse(null, { status: 204 });
}
