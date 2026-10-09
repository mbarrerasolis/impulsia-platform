import { NextResponse } from "next/server";
import { z } from "zod";
import { leadTemperatureSchema, temperatureScores } from "@/domain/crm/lead-temperature";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { routeError } from "@/lib/http/route-error";
import { getLeadRepository } from "@/repositories";

const updateLeadSchema = z.object({ temperature: leadTemperatureSchema });

/** Clasificación manual de temperatura: fija un score representativo de la banda elegida. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireInternalApiRole(["owner_admin", "sales"]);
    const { id } = await params;
    const { temperature } = updateLeadSchema.parse(await request.json());
    const score = temperatureScores[temperature];
    await getLeadRepository().updateScore(id, score);
    return NextResponse.json({ temperature, score });
  } catch (error) {
    return routeError(error, "lead.update.failed");
  }
}
