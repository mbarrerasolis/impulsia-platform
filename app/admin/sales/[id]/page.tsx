import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentReview, SaleActions } from "@/components/sale-editor";
import {
  currentQuote, deliveryModeLabels, missingForOrder, paymentMethodLabels, paymentStatusLabels, quoteReference, quoteText, saleStatusLabels,
} from "@/domain/storefront/sales";
import { formatPhone, whatsappLink } from "@/domain/crm/phone";
import { internalRoles, requireRole } from "@/lib/auth/authorization";
import { getSaleRepository } from "@/repositories";
import { linesToItems } from "@/services/store/sales";
import { editionMoney, saleCatalogOptions } from "@/services/store/sales-runtime";
import { formatSaleDateTime, saleStatusClass } from "../format";

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(internalRoles);
  const [sale, options] = await Promise.all([getSaleRepository().get(id), saleCatalogOptions()]);
  if (!sale) notFound();
  const money = editionMoney();
  const quote = currentQuote(sale)!;
  const canEdit = ["owner_admin", "sales", "finance"].includes(user.role);
  const canReview = ["owner_admin", "finance"].includes(user.role);
  const missing = sale.status === "quote_accepted" ? missingForOrder({ ...sale, paymentMethod: sale.paymentMethod ?? "transfer", document: sale.document ?? "boleta" }) : [];
  const { customer } = sale;
  const whatsapp = whatsappLink(customer.phone);

  return <>
    <div className="admin-title">
      <div>
        <p className="muted"><Link href={"/admin/sales" as Route}>Ventas</Link> / {sale.number}</p>
        <h1>{sale.orderNumber ? `Pedido ${sale.orderNumber}` : `Cotización ${quoteReference(sale.number, quote.version)}`}</h1>
        <p><span className={`state ${saleStatusClass[sale.status]}`}>{saleStatusLabels[sale.status]}</span> <span className="muted">· creada {formatSaleDateTime(sale.createdAt)}{sale.orderNumber ? ` · ${quoteReference(sale.number, quote.version)}` : ""}</span></p>
      </div>
    </div>

    <div className="sale-grid">
      <section className="card panel">
        <h2>Cotización vigente (V{quote.version})</h2>
        <div className="table-wrap">
          <table className="data-table compact">
            <thead><tr><th>Producto</th><th className="num">Cantidad</th><th className="num">Precio c/u</th><th className="num">Subtotal</th></tr></thead>
            <tbody>{quote.lines.map((line) => <tr key={line.id}>
              <td>{line.name}{line.format && <span className="muted"> · {line.format}</span>}{line.sku && <span className="muted lead-sub">{line.sku}</span>}</td>
              <td className="num">{line.quantity}</td>
              <td className="num">{money(line.unitPrice)}</td>
              <td className="num">{money(line.unitPrice * line.quantity)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <dl className="sale-totals">
          <div><dt>Neto</dt><dd>{money(quote.totals.net)}</dd></div>
          <div><dt>IVA</dt><dd>{money(quote.totals.vat)}</dd></div>
          <div><dt>Productos</dt><dd>{money(quote.totals.products)}</dd></div>
          <div><dt>Transporte</dt><dd>{quote.totals.shipping === undefined ? "Por confirmar" : money(quote.totals.shipping)}</dd></div>
          <div className="sale-total"><dt>Total</dt><dd>{money(quote.totals.total)}</dd></div>
        </dl>
        <p className="muted">Vigente hasta {formatSaleDateTime(quote.validUntil)}{new Date(quote.validUntil) < new Date() ? " (vencida)" : ""}.{quote.notes ? ` Observaciones: ${quote.notes}` : ""}</p>
        {sale.versions.length > 1 && <details className="sale-versions">
          <summary>Versiones anteriores ({sale.versions.length - 1})</summary>
          <ul>{sale.versions.slice().reverse().map((version) => <li key={version.version}>
            <strong>V{version.version}</strong> · {formatSaleDateTime(version.createdAt)} · {money(version.totals.total)} · {version.createdVia === "assistant" ? "vendedora virtual" : "equipo"}
            {version.changes && <span className="muted"> — {version.changes}</span>}
          </li>)}</ul>
        </details>}
      </section>

      <section className="card panel">
        <h2>Cliente y entrega</h2>
        <dl className="sale-facts">
          <div><dt>Cliente</dt><dd>{customer.name}{customer.kind === "negocio" && customer.company ? ` · ${customer.company}` : ""}</dd></div>
          {customer.taxId && <div><dt>RUT</dt><dd>{customer.taxId}</dd></div>}
          {customer.phone && <div><dt>Teléfono</dt><dd>{whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" title="Escribir por WhatsApp">{formatPhone(customer.phone)}</a> : <>{customer.phone} <span className="state danger">revisar número</span></>}</dd></div>}
          {customer.email && <div><dt>Email</dt><dd><a href={`mailto:${customer.email}`}>{customer.email}</a></dd></div>}
          <div><dt>Destino</dt><dd>{sale.destination || "Por definir"}</dd></div>
          <div><dt>Entrega</dt><dd>{deliveryModeLabels[sale.deliveryMode]}{sale.carrier ? ` · ${sale.carrier}` : ""}</dd></div>
          {sale.paymentMethod && <div><dt>Pago</dt><dd>{paymentMethodLabels[sale.paymentMethod]}</dd></div>}
          {sale.document && <div><dt>Documento</dt><dd>{sale.document === "factura" ? "Factura" : "Boleta"}</dd></div>}
          {sale.billing && <div><dt>Facturación</dt><dd>{sale.billing.legalName} · {sale.billing.taxId} · {sale.billing.activity} · {sale.billing.address}, {sale.billing.commune} · {sale.billing.email}{sale.billing.purchaseOrder ? ` · OC ${sale.billing.purchaseOrder}` : ""}</dd></div>}
          {sale.tracking && <div><dt>Seguimiento</dt><dd>{sale.tracking}</dd></div>}
          {sale.leadId && <div><dt>CRM</dt><dd><Link href={`/admin/crm/${sale.leadId}` as Route}>Ver lead</Link></dd></div>}
          {sale.conversationId && <div><dt>Conversación</dt><dd><Link href={`/admin/conversations/${sale.conversationId}` as Route}>Abrir chat</Link></dd></div>}
        </dl>
        {missing.length > 0 && <p className="muted">Para crear el pedido falta: {missing.join(", ")}.</p>}
      </section>
    </div>

    {canEdit && <SaleActions options={options} sale={{
      id: sale.id,
      status: sale.status,
      paymentMethod: sale.paymentMethod,
      deliveryMode: sale.deliveryMode,
      destination: sale.destination,
      lines: linesToItems(quote.lines).map((item) => ({ variantKey: `${item.clave}::${item.presentacion ?? ""}`, quantity: item.cantidad })),
      shipping: quote.totals.shipping,
      total: quote.totals.total,
      quoteText: quoteText(sale, quote, money, formatSaleDateTime),
    }} />}

    <section className="card panel" style={{ marginTop: 16 }}>
      <h2>Pagos</h2>
      {sale.payments.length === 0
        ? <p className="muted">Sin pagos registrados.</p>
        : <div className="table-wrap">
          <table className="data-table compact">
            <thead><tr><th>Fecha</th><th>Forma</th><th className="num">Monto</th><th>Estado</th><th>Detalle</th></tr></thead>
            <tbody>{sale.payments.map((payment) => <tr key={payment.id}>
              <td>{formatSaleDateTime(payment.createdAt)}</td>
              <td>{paymentMethodLabels[payment.method]} <span className="muted">· V{payment.quoteVersion}</span></td>
              <td className="num">{money(payment.amount)}{payment.amount !== payment.expectedAmount && <span className="state danger lead-sub">Total: {money(payment.expectedAmount)}</span>}</td>
              <td><span className={`state ${payment.status === "approved" ? "active" : payment.status === "rejected" ? "danger" : "paused"}`}>{paymentStatusLabels[payment.status]}</span></td>
              <td>
                {[payment.payer, payment.paidOn, payment.note, payment.reviewNote].filter(Boolean).join(" · ") || <span className="muted">—</span>}
                {payment.status === "in_review" && canReview && <PaymentReview saleId={sale.id} paymentId={payment.id} />}
                {payment.status === "in_review" && !canReview && <span className="muted lead-sub">Lo aprueba administración.</span>}
              </td>
            </tr>)}</tbody>
          </table>
        </div>}
    </section>

    <section className="card panel" style={{ marginTop: 16 }}>
      <h2>Historial</h2>
      <ol className="sale-history">{sale.events.slice().reverse().map((event) => <li key={event.id}>
        <span className="muted">{formatSaleDateTime(event.createdAt)}</span> · <strong>{saleStatusLabels[event.to]}</strong> · {event.via === "assistant" ? "vendedora virtual" : "equipo"}{event.note ? ` — ${event.note}` : ""}
      </li>)}</ol>
    </section>
  </>;
}
