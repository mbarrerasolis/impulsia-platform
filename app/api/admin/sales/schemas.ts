import { NextResponse } from "next/server";
import { z } from "zod";
import { SaleRuleError } from "@/services/store/sales";

/** Quiénes del equipo arman cotizaciones y mueven pedidos; aprobar pagos es de administración. */
export const saleEditorRoles = ["owner_admin", "sales", "finance"] as const;
export const paymentReviewerRoles = ["owner_admin", "finance"] as const;

export const saleItemsSchema = z.array(z.object({
  clave: z.string().trim().min(1).max(80),
  presentacion: z.string().trim().max(40).default(""),
  cantidad: z.number().int().min(1).max(9999),
})).min(1).max(60);

/** Una regla de la venta que no se cumple se muestra tal cual al equipo. */
export function saleRouteError(error: unknown) {
  return error instanceof SaleRuleError ? NextResponse.json({ error: error.message }, { status: 409 }) : undefined;
}
