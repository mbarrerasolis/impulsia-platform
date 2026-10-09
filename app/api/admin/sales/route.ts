import { NextResponse } from "next/server";
import { z } from "zod";
import { deliveryModes, saleCustomerSchema } from "@/domain/storefront/sales";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { moduleDisabledResponse } from "@/lib/business";
import { routeError } from "@/lib/http/route-error";
import { createQuote } from "@/services/store/sales";
import { salesDeps } from "@/services/store/sales-runtime";
import { saleEditorRoles, saleItemsSchema, saleRouteError } from "./schemas";

const createSchema = z.object({
  customer: saleCustomerSchema,
  destination: z.string().trim().max(200).default(""),
  deliveryMode: z.enum(deliveryModes),
  items: saleItemsSchema,
  shipping: z.number().int().min(0).max(10_000_000).optional(),
  notes: z.string().trim().max(1000).optional(),
  leadId: z.uuid().optional(),
});

/** Cotización armada por el equipo en el panel (queda en preparación hasta marcarla enviada). */
export async function POST(request: Request) {
  const disabled = moduleDisabledResponse("store");
  if (disabled) return disabled;
  try {
    const user = await requireInternalApiRole(saleEditorRoles);
    const input = createSchema.parse(await request.json());
    const { sale, problems } = await createQuote(await salesDeps(), { ...input, via: "panel", actorId: user.id });
    return NextResponse.json({ id: sale.id, number: sale.number, problems }, { status: 201 });
  } catch (error) {
    return saleRouteError(error) ?? routeError(error, "sales.create_failed");
  }
}
