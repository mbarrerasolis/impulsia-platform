import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { inventoryEditorRoles, variantUpdateSchema } from "@/domain/storefront/inventory";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { moduleDisabledResponse } from "@/lib/business";
import { routeError } from "@/lib/http/route-error";
import { updateVariant } from "@/services/store/inventory";

/** Cambia SKU, precio, si se vende o el aviso de stock bajo de una presentación. */
export async function PATCH(request: Request) {
  const disabled = moduleDisabledResponse("store");
  if (disabled) return disabled;
  try {
    await requireInternalApiRole(inventoryEditorRoles);
    const record = await updateVariant(variantUpdateSchema.parse(await request.json()));
    revalidatePath("/");
    revalidatePath("/productos/[key]", "page");
    return NextResponse.json(record);
  } catch (error) {
    return routeError(error, "inventory.variant_update_failed");
  }
}
