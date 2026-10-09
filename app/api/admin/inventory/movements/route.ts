import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { inventoryEditorRoles, movementInputSchema } from "@/domain/storefront/inventory";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { moduleDisabledResponse } from "@/lib/business";
import { routeError } from "@/lib/http/route-error";
import { moveStock } from "@/services/store/inventory";

/** Ingreso, conteo, merma, devolución o venta fuera del sitio de una presentación. */
export async function POST(request: Request) {
  const disabled = moduleDisabledResponse("store");
  if (disabled) return disabled;
  try {
    await requireInternalApiRole(inventoryEditorRoles);
    const stock = await moveStock(movementInputSchema.parse(await request.json()));
    revalidatePath("/");
    revalidatePath("/productos/[key]", "page");
    return NextResponse.json({ stock }, { status: 201 });
  } catch (error) {
    return routeError(error, "inventory.movement_failed");
  }
}
