import { NextResponse } from "next/server";
import { z } from "zod";
import { billingSchema, deliveryModes, documentKinds, paymentMethods, saleCustomerSchema, saleStatuses } from "@/domain/storefront/sales";
import { requireInternalApiRole } from "@/lib/auth/api-authorization";
import { moduleDisabledResponse } from "@/lib/business";
import { routeError } from "@/lib/http/route-error";
import { getSaleRepository } from "@/repositories";
import { acceptQuote, changeStatus, choosePayment, registerTransfer, reviewPayment, reviseQuote, SaleRuleError } from "@/services/store/sales";
import { salesDeps } from "@/services/store/sales-runtime";
import { paymentReviewerRoles, saleEditorRoles, saleItemsSchema, saleRouteError } from "../schemas";

const note = z.string().trim().max(500).optional();
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revise"), items: saleItemsSchema.optional(), shipping: z.number().int().min(0).max(10_000_000).nullable().optional(), notes: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("payment"), method: z.enum(paymentMethods), document: z.enum(documentKinds), billing: billingSchema.optional(), deliveryMode: z.enum(deliveryModes).optional(), destination: z.string().trim().max(200).optional(), carrier: z.string().trim().max(120).optional() }),
  z.object({ action: z.literal("transfer"), amount: z.number().int().min(0).max(1_000_000_000), payer: z.string().trim().max(160).optional(), paidOn: z.iso.date().optional(), note }),
  z.object({ action: z.literal("review"), paymentId: z.uuid().or(z.string().min(8).max(64)), approve: z.boolean(), note }),
  z.object({ action: z.literal("status"), to: z.enum(saleStatuses), note, tracking: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("details"), customer: saleCustomerSchema.optional(), destination: z.string().trim().max(200).optional(), deliveryMode: z.enum(deliveryModes).optional(), carrier: z.string().trim().max(120).optional(), notes: z.string().trim().max(2000).optional() }),
]);

/** Acciones del equipo sobre una venta; las reglas (estados, versiones, montos) están en el servicio. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const disabled = moduleDisabledResponse("store");
  if (disabled) return disabled;
  try {
    const input = actionSchema.parse(await request.json());
    const user = await requireInternalApiRole(input.action === "review" ? paymentReviewerRoles : saleEditorRoles);
    const { id } = await params;
    const actor = { via: "panel" as const, actorId: user.id };
    const deps = await salesDeps({ withStock: input.action === "review" || input.action === "status" });
    let warnings: string[] = [];
    switch (input.action) {
      case "revise": await reviseQuote(deps, id, { items: input.items, shipping: input.shipping, notes: input.notes, ...actor }); break;
      case "accept": await acceptQuote(deps, id, actor); break;
      case "payment": await choosePayment(deps, id, { ...input, ...actor }); break;
      case "transfer": await registerTransfer(deps, id, { amount: input.amount, payer: input.payer, paidOn: input.paidOn, note: input.note, ...actor }); break;
      case "review": ({ warnings } = await reviewPayment(deps, id, { paymentId: input.paymentId, approve: input.approve, note: input.note, actorId: user.id })); break;
      case "status": ({ warnings } = await changeStatus(deps, id, { to: input.to, note: input.note, tracking: input.tracking, ...actor })); break;
      case "details": {
        const sale = await getSaleRepository().get(id);
        if (!sale) throw new SaleRuleError("Venta no encontrada.");
        if (["delivered", "cancelled"].includes(sale.status)) throw new SaleRuleError("La venta está cerrada.");
        await getSaleRepository().update(id, { customer: input.customer, destination: input.destination, deliveryMode: input.deliveryMode, carrier: input.carrier, notes: input.notes });
        break;
      }
    }
    return NextResponse.json({ ok: true, warnings });
  } catch (error) {
    return saleRouteError(error) ?? routeError(error, "sales.action_failed");
  }
}
