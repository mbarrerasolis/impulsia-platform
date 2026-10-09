import "server-only";
import { currentQuote, quoteReference, saleStatusLabels } from "@/domain/storefront/sales";
import { createEmailProvider } from "@/integrations/email";
import { getBrandConfig } from "@/lib/brand";
import { getServerEnv } from "@/lib/env";
import { getStorefront } from "@/lib/storefront";
import type { SaleNotification } from "@/services/messaging/store-sales-tools";
import { editionMoney } from "./sales-runtime";

/**
 * Avisos al equipo de lo que hizo la vendedora virtual: cotización emitida, pedido creado y
 * comprobante recibido (este último también a la copia administrativa de comprobantes).
 */
export function createSaleNotifier() {
  return async ({ kind, sale, payment, matches }: SaleNotification) => {
    const brand = getBrandConfig();
    const money = editionMoney();
    const quote = currentQuote(sale)!;
    const reference = sale.orderNumber ?? quoteReference(sale.number, quote.version);
    const subject = {
      quote: `Cotización ${reference} emitida: ${sale.customer.name} (${money(quote.totals.total)})`,
      order: `Pedido ${reference}: ${sale.customer.name} eligió ${sale.paymentMethod === "transfer" ? "transferencia" : "pago en la página"}`,
      transfer: `Comprobante por revisar ${reference}: ${money(payment?.amount ?? 0)}${matches === false ? " (NO coincide con el total)" : ""}`,
    }[kind];
    const cc = kind === "transfer" ? getStorefront()?.transfer?.receiptsCc : undefined;
    await createEmailProvider().send({
      to: brand.contactEmail,
      ...(cc ? { cc: [cc] } : {}),
      ...(sale.customer.email ? { replyTo: sale.customer.email } : {}),
      subject,
      text: [
        kind === "transfer"
          ? `La vendedora virtual registró un comprobante de transferencia. La venta quedó con el pago en revisión: apruébalo o recházalo en el panel después de verificar el abono en el banco.`
          : `La vendedora virtual dejó la venta en "${saleStatusLabels[sale.status]}".`,
        ``,
        `Cliente: ${sale.customer.name}${sale.customer.company ? ` · ${sale.customer.company}` : ""}`,
        ...(sale.customer.phone ? [`Teléfono: ${sale.customer.phone}`] : []),
        `Total: ${money(quote.totals.total)}${quote.totals.shipping === undefined ? " (transporte por confirmar)" : ""}`,
        ...(payment ? [`Comprobante: ${money(payment.amount)}${payment.payer ? ` · pagador ${payment.payer}` : ""}${payment.paidOn ? ` · ${payment.paidOn}` : ""}`] : []),
        ``,
        `Ver la venta: ${getServerEnv().NEXT_PUBLIC_APP_URL}/admin/sales/${sale.id}`,
        ...(sale.conversationId ? [`Ver el chat (y el comprobante): ${getServerEnv().NEXT_PUBLIC_APP_URL}/admin/conversations/${sale.conversationId}`] : []),
      ].join("\n"),
    });
  };
}
