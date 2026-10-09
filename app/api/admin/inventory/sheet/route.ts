import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { catalogVariants, inventoryCsv, inventoryEditorRoles } from "@/domain/storefront/inventory";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { moduleDisabledResponse } from "@/lib/business";
import { routeError } from "@/lib/http/route-error";
import { getStorefront } from "@/lib/storefront";
import { getInventoryRepository } from "@/repositories";
import { importInventory } from "@/services/store/inventory";

const maxSheetBytes = 512 * 1024;

/** Descarga la planilla del inventario (CSV para Excel) con lo que hay hoy. */
export async function GET() {
  const disabled = moduleDisabledResponse("store");
  if (disabled) return disabled;
  try {
    await requireInternalApiRole();
    const storefront = getStorefront();
    if (!storefront) throw new Error("Esta edición no admite inventario: no tiene tienda.");
    const csv = inventoryCsv(catalogVariants(storefront), await getInventoryRepository().list());
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="inventario-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error, "inventory.sheet_export_failed");
  }
}

/** Carga la planilla completada: precios, SKU, activo y stock contado. Todo o nada. */
export async function POST(request: Request) {
  const disabled = moduleDisabledResponse("store");
  if (disabled) return disabled;
  try {
    await requireInternalApiRole(inventoryEditorRoles);
    const text = await request.text();
    if (!text.trim()) return NextResponse.json({ error: "La planilla está vacía." }, { status: 400 });
    if (new TextEncoder().encode(text).length > maxSheetBytes) return NextResponse.json({ error: "La planilla supera 512 KB." }, { status: 413 });
    const result = await importInventory(text);
    if (result.errors.length) return NextResponse.json({ error: "La planilla tiene errores; no se cambió nada.", errors: result.errors.slice(0, 20) }, { status: 422 });
    revalidatePath("/");
    revalidatePath("/productos/[key]", "page");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && /columna codigo|está vacía/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    return routeError(error, "inventory.sheet_import_failed");
  }
}
