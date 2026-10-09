import { z } from "zod";
import { normalizePhone } from "@/domain/crm/phone";
import type { Lead } from "@/domain/crm/entities";
import { parseLeadAttribution } from "@/domain/marketing/attribution";
import type { Storefront } from "@/domain/config/storefront";
import { quoteMixLine } from "./custom-mix";
import { orderSummary, quoteOrder } from "./assistant-catalog";

/**
 * Pedido enviado desde el carro de la tienda: antes de abrir WhatsApp o el correo se guarda como
 * lead en el CRM, con el pedido recalculado en el servidor (el navegador sólo manda qué y cuánto).
 */
export const orderLeadSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(100),
  /** Normalizado (+56912345678) para que el equipo pueda escribirle por WhatsApp desde el CRM. */
  phone: z.string().trim().max(30).transform((value, context) => {
    const normalized = normalizePhone(value);
    if (!normalized) context.addIssue({ code: "custom", message: "Escribe un teléfono válido (ej.: 9 1234 5678 o +56 9 1234 5678)." });
    return normalized ?? value;
  }),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Revisa el email."))]).default(""),
  city: z.string().trim().min(2, "Indica tu ciudad o comuna.").max(120),
  customerType: z.enum(["persona", "negocio"]),
  company: z.string().trim().max(140).default(""),
  notes: z.string().trim().max(1_000).default(""),
  /** Líneas del carro: "<producto>::<presentación>" o "mix::<ingrediente>+<ingrediente>". */
  items: z.array(z.object({ id: z.string().min(3).max(300), quantity: z.number().int().min(1).max(99) })).min(1).max(40),
  channel: z.enum(["whatsapp", "email"]),
  consentGiven: z.literal(true, "Necesitamos tu autorización para contactarte por el pedido."),
  attribution: z.unknown().optional().transform(parseLeadAttribution),
}).refine((value) => value.customerType === "persona" || value.company.length >= 2, { path: ["company"], message: "Escribe el nombre de tu negocio." });

export type OrderLeadInput = z.infer<typeof orderLeadSchema>;

/** Objetivo con que quedan los pedidos (del carro o del chat) en el CRM; el panel los cuenta como pedidos. */
export const storeOrderGoals = ["Pedido en tienda", "Compra mayorista"] as const;

/** Puntaje inicial: monto del pedido y si compra para un negocio. */
export function orderLeadScore(total: number | undefined, customerType: OrderLeadInput["customerType"]) {
  const base = !total ? 35 : total >= 100_000 ? 70 : total >= 30_000 ? 55 : 40;
  return Math.min(100, base + (customerType === "negocio" ? 15 : 0));
}

export function buildOrderLead(storefront: Pick<Storefront, "products" | "pricing" | "mix">, input: OrderLeadInput, money: (amount: number) => string) {
  const productItems = input.items.filter((item) => !item.id.startsWith("mix::")).map((item) => {
    const [clave, presentacion = ""] = item.id.split("::");
    return { clave, presentacion, cantidad: item.quantity };
  });
  const quote = quoteOrder(storefront, productItems);
  const mixLines = storefront.mix ? input.items.filter((item) => item.id.startsWith("mix::")).map((item) => {
    const mix = quoteMixLine(storefront.mix!, item.id, storefront.pricing);
    return { quantity: item.quantity, text: `${mix.parts.map((part) => `${part.name} ${part.grams} g`).join(", ")}${mix.problems.length ? ` — revisar: ${mix.problems.join(" ")}` : ""}`, price: mix.price, net: mix.net };
  }).filter((line) => line.text) : [];
  const mixTotal = mixLines.reduce((sum, line) => sum + (line.price ?? 0) * line.quantity, 0);
  const complete = quote.lines.every((line) => line.price) && mixLines.every((line) => line.price);
  const total = (quote.total ?? 0) + mixTotal || undefined;
  const wholesale = input.customerType === "negocio";
  const summary = [
    `Pedido desde la tienda (${wholesale ? "negocio" : "persona"}) — despacho: ${input.city} — enviado por ${input.channel === "whatsapp" ? "WhatsApp" : "correo"}`,
    quote.lines.length ? orderSummary(quote.lines, money) : "",
    ...mixLines.map((line) => `• ${line.quantity} × Mix ${storefront.mix?.wholesale ? "mayorista " : ""}a medida (${line.text})${line.price ? ` — ${money(line.price * line.quantity)}${line.net ? ` (neto ${money(line.net * line.quantity)} + IVA)` : ""}` : ""}`),
    total ? `Total productos: ${money(total)} IVA incluido (sin despacho)${complete ? "" : "; hay productos con precio a confirmar"}` : "Total a confirmar",
    ...(quote.problems.length ? [`No incluido: ${quote.problems.join(" ")}`] : []),
    ...(input.notes ? [`Comentarios: ${input.notes}`] : []),
  ].filter(Boolean).join("\n");

  const lead: Omit<Lead, "id" | "createdAt"> = {
    source: "web",
    name: input.name,
    company: wholesale ? input.company : "Particular",
    email: input.email,
    phone: input.phone,
    rawNeedDescription: summary,
    systems: [],
    apiKnowledge: "unknown",
    primaryGoal: wholesale ? storeOrderGoals[1] : storeOrderGoals[0],
    status: "new",
    score: orderLeadScore(total, input.customerType),
    consentGiven: true,
    ...(input.attribution ? { attribution: input.attribution } : {}),
  };
  return { lead, total, lines: quote.lines.length + mixLines.length, problems: quote.problems };
}
