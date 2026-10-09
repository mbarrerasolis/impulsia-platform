import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { moduleDisabledResponse } from "@/lib/business";
import { routeError } from "@/lib/http/route-error";
import { getReviewRepository } from "@/repositories";

const moderationSchema = z.object({ status: z.enum(["approved", "rejected"]) });

/** Aprueba (publica) o rechaza una reseña. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = moduleDisabledResponse("store");
  if (disabled) return disabled;
  try {
    const user = await requireInternalApiRole(["owner_admin", "sales", "support"]);
    const { id } = await params;
    const { status } = moderationSchema.parse(await request.json());
    const review = await getReviewRepository().moderate(z.uuid().parse(id), status, user.id === "demo-owner" ? undefined : user.id);
    // La portada muestra las reseñas publicadas: se regenera en la próxima visita.
    revalidatePath("/");
    return NextResponse.json({ id: review.id, status: review.status });
  } catch (error) {
    return routeError(error, "review.moderate_failed");
  }
}
