import { after, NextResponse } from "next/server";
import { ZodError } from "zod";
import { buildOrderLead, orderLeadSchema } from "@/domain/storefront/order-lead";
import { createEmailProvider } from "@/integrations/email";
import { getBrandConfig } from "@/lib/brand";
import { moduleDisabledResponse } from "@/lib/business";
import { getEditionConfig } from "@/lib/edition";
import { getServerEnv } from "@/lib/env";
import { formatMoney } from "@/lib/format";
import { getStorefront } from "@/lib/storefront";
import { getLeadRepository } from "@/repositories";
import { detectBotSubmission, splitLeadSubmission } from "@/services/leads/lead-spam-guard";
import { storefrontWithInventory } from "@/services/store/inventory";

/** Tope de pedidos web por hora (protege el CRM y el correo del equipo ante un ataque). */
const maxOrdersPerHour = 40;

/**
 * Pedido del carro de la tienda: se guarda como lead (con el pedido recalculado aquí) antes de que el
 * cliente lo envíe por WhatsApp o correo, y se avisa al equipo. Al cliente no se le envían correos,
 * así que basta con campo trampa, tiempo mínimo y un tope por hora.
 */
export async function POST(request: Request) {
  const disabled = moduleDisabledResponse("store");
  if (disabled) return disabled;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 20_000) return NextResponse.json({ error: "El pedido es demasiado grande." }, { status: 413 });
    const { signals, input } = splitLeadSubmission(await request.json());
    if (detectBotSubmission(signals)) return NextResponse.json({ received: true }, { status: 201 });
    const order = orderLeadSchema.parse(input);
    const manifest = getStorefront();
    if (!manifest) return NextResponse.json({ error: "La tienda no está disponible." }, { status: 404 });

    const repository = getLeadRepository();
    if (await repository.countWebLeadsSince(new Date(Date.now() - 60 * 60 * 1000).toISOString()) >= maxOrdersPerHour) {
      console.warn("store.order.rate_limited");
      return NextResponse.json({ error: "Estamos recibiendo muchos pedidos. Envíalo directamente por WhatsApp." }, { status: 429 });
    }
    const edition = getEditionConfig();
    const money = (amount: number) => formatMoney(amount, edition.pricing.currency, edition.locale);
    const built = buildOrderLead(await storefrontWithInventory(manifest), order, money);
    if (!built.lines) return NextResponse.json({ error: "El carro no tiene productos disponibles." }, { status: 400 });
    const lead = await repository.create(built.lead);

    after(async () => {
      try {
        const brand = getBrandConfig();
        const env = getServerEnv();
        await createEmailProvider().send({
          to: brand.contactEmail,
          ...(lead.email ? { replyTo: lead.email } : {}),
          subject: `Nuevo pedido web: ${lead.name}${built.total ? ` (${money(built.total)})` : ""}`,
          text: [
            `Llegó un pedido desde la tienda; el cliente lo está enviando por ${order.channel === "whatsapp" ? "WhatsApp" : "correo"}.`,
            ``,
            `Nombre: ${lead.name}`,
            `Teléfono: ${lead.phone}`,
            ...(lead.email ? [`Email: ${lead.email}`] : []),
            ...(order.customerType === "negocio" ? [`Negocio: ${lead.company}`] : []),
            ``,
            lead.rawNeedDescription,
            ``,
            `Ver en el CRM: ${env.NEXT_PUBLIC_APP_URL}/admin/crm/${lead.id}`,
          ].join("\n"),
        });
      } catch (error) {
        console.error("store.order.notification_failed", { leadId: lead.id, message: error instanceof Error ? error.message : "unknown" });
      }
    });
    return NextResponse.json({ id: lead.id, total: built.total }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Revisa los datos.", issues: error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
    console.error("store.order.failed", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No pudimos registrar el pedido." }, { status: 500 });
  }
}
