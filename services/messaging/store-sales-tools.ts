import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Storefront } from "@/domain/config/storefront";
import { normalizePhone } from "@/domain/crm/phone";
import { currentQuote, quoteReference, quoteText, saleStatusCodes, type Sale, type SalePayment } from "@/domain/storefront/sales";
import { acceptQuote, choosePayment, createQuote, registerTransfer, reviseQuote, SaleRuleError, type SalesDeps } from "@/services/store/sales";

/**
 * Herramientas de venta del asistente de la tienda (manual del vendedor, secciones 8 a 14): emitir y
 * modificar la cotización numerada, registrar la aceptación, la forma de pago (pasa a pedido) y el
 * comprobante de transferencia (queda en revisión). Trabajan sobre la venta abierta de la conversación.
 */

export const salesToolNames = ["preparar_cotizacion", "modificar_cotizacion", "aceptar_cotizacion", "registrar_forma_de_pago", "registrar_comprobante"] as const;
export type SalesToolName = (typeof salesToolNames)[number];

export interface SaleNotification {
  kind: "quote" | "order" | "transfer";
  sale: Sale;
  payment?: SalePayment;
  matches?: boolean;
}

export interface SalesToolContext {
  deps: SalesDeps;
  conversationId: string;
  leadId: string | null;
  /** Teléfono del cliente cuando escribe por WhatsApp (como lo entrega Meta: código de país, con o sin "+"). */
  contactPhone?: string;
  transfer?: Storefront["transfer"];
  /** La pasarela (Flow) está conectada; sin ella sólo se ofrece transferencia. */
  gatewayEnabled: boolean;
  formatDate: (iso: string) => string;
  notify?: (notification: SaleNotification) => Promise<void>;
}

const itemsJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      clave: { type: "string", description: "Valor \"clave\" del producto, tal como lo devolvió buscar_productos." },
      presentacion: { type: "string", description: "Presentación exacta (\"500 g\", \"1 kg\"); vacío si se vende por unidad." },
      cantidad: { type: "integer", description: "Cantidad de esa presentación." },
    },
    required: ["clave", "presentacion", "cantidad"],
    additionalProperties: false,
  },
} as const;
const deliveryJsonSchema = { type: "string", enum: ["despacho", "retiro", "por_definir"] } as const;

/**
 * Sin `strict`: junto con las herramientas del catálogo, la gramática de herramientas estrictas supera el
 * límite de la API ("compiled grammar is too large"). Los datos igual se validan aquí con zod.
 */
export const salesTools: Anthropic.Tool[] = [
  {
    name: "preparar_cotizacion",
    description: "Emite la cotización numerada (COT-AAAA-NNNNN-V1) con precios, neto, IVA, transporte y vigencia calculados por el sistema. Úsala cuando el cliente pida la cotización formal y ya esté registrado con registrar_pedido. Muéstrale el texto que devuelve tal cual. Si ya hay una cotización abierta en la conversación, usa modificar_cotizacion.",
    strict: false,
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        tipo_cliente: { type: "string", enum: ["persona", "negocio"] },
        empresa: { type: "string", description: "Empresa o negocio; vacío si es persona." },
        rut: { type: "string", description: "RUT si lo dio; vacío si no." },
        email: { type: "string", description: "Email si lo dio; vacío si no." },
        telefono: { type: "string", description: "Teléfono si escribe por el chat del sitio o Instagram; vacío en WhatsApp." },
        destino: { type: "string", description: "Región, comuna y localidad de despacho o retiro." },
        entrega: deliveryJsonSchema,
        transporte_con_iva: { type: ["integer", "null"], description: "Costo de transporte confirmado con IVA; null si aún no está cotizado (lo normal: lo confirma el equipo)." },
        items: itemsJsonSchema,
        observaciones: { type: "string", description: "Observaciones para la cotización; vacío si no hay." },
      },
      required: ["nombre", "tipo_cliente", "empresa", "rut", "email", "telefono", "destino", "entrega", "transporte_con_iva", "items", "observaciones"],
      additionalProperties: false,
    },
  },
  {
    name: "modificar_cotizacion",
    description: "Crea la versión siguiente de la cotización abierta (mismo número, V+1) con los productos que indiques y precios vigentes. Invalida la versión anterior y su aceptación: muéstrale al cliente el texto nuevo y pide que la acepte otra vez. No sirve si la venta ya tiene un comprobante en revisión o está pagada (deriva).",
    strict: false,
    input_schema: {
      type: "object",
      properties: {
        items: { ...itemsJsonSchema, description: "Lista COMPLETA de productos de la nueva versión; vacía para mantener los mismos (sólo recotizar)." },
        transporte_con_iva: { type: ["integer", "null"], description: "Nuevo costo de transporte con IVA; null para mantener el actual." },
        observaciones: { type: "string", description: "Observaciones nuevas; vacío para mantener las actuales." },
      },
      required: ["items", "transporte_con_iva", "observaciones"],
      additionalProperties: false,
    },
  },
  {
    name: "aceptar_cotizacion",
    description: "Registra que el cliente aceptó la versión vigente, después de mostrarle el resumen (productos, cantidades, despacho, destino, totales y vigencia) y de que confirme explícitamente que todo está correcto.",
    strict: false,
    input_schema: { type: "object", properties: { version: { type: "integer", description: "Versión que el cliente aceptó (la vigente)." } }, required: ["version"], additionalProperties: false },
  },
  {
    name: "registrar_forma_de_pago",
    description: "Con la cotización aceptada, registra la forma de pago y el documento: la venta pasa a pedido (PED-AAAA-NNNNN) con pago pendiente. Pide antes lo que falte (retiro o despacho, destino; para factura: razón social, RUT, giro, dirección, comuna y correo, repitiéndolos para confirmar). Si es transferencia devuelve los datos bancarios oficiales para entregar tal cual.",
    strict: false,
    input_schema: {
      type: "object",
      properties: {
        forma: { type: "string", enum: ["transferencia", "pagina"] },
        documento: { type: "string", enum: ["boleta", "factura"] },
        entrega: deliveryJsonSchema,
        destino: { type: "string", description: "Destino confirmado; vacío para mantener el de la cotización." },
        transportista: { type: "string", description: "Transportista elegido; vacío si no aplica o no está definido." },
        razon_social: { type: "string", description: "Sólo factura; vacío si boleta." },
        rut_factura: { type: "string", description: "Sólo factura; vacío si boleta." },
        giro: { type: "string", description: "Sólo factura; vacío si boleta." },
        direccion: { type: "string", description: "Dirección tributaria; sólo factura." },
        comuna: { type: "string", description: "Comuna tributaria; sólo factura." },
        correo_factura: { type: "string", description: "Sólo factura; vacío si boleta." },
        orden_compra: { type: "string", description: "Orden de compra si la tiene; vacío si no." },
      },
      required: ["forma", "documento", "entrega", "destino", "transportista", "razon_social", "rut_factura", "giro", "direccion", "comuna", "correo_factura", "orden_compra"],
      additionalProperties: false,
    },
  },
  {
    name: "registrar_comprobante",
    description: "Registra el comprobante de transferencia que envió el cliente (imagen o PDF del mensaje actual): asocia monto, fecha y pagador visibles al pedido y lo deja con el pago en revisión. Avisa al equipo. Nunca digas que el pago está recibido o aprobado.",
    strict: false,
    input_schema: {
      type: "object",
      properties: {
        monto: { type: "integer", description: "Monto que muestra el comprobante, en pesos." },
        pagador: { type: "string", description: "Nombre del pagador visible; vacío si no se ve." },
        fecha: { type: "string", description: "Fecha del comprobante AAAA-MM-DD; vacío si no se ve." },
        titular_destino: { type: "string", description: "Titular de la cuenta de destino que muestra el comprobante; vacío si no se ve." },
      },
      required: ["monto", "pagador", "fecha", "titular_destino"],
      additionalProperties: false,
    },
  },
];

const itemsSchema = z.array(z.object({ clave: z.string().trim().min(1).max(80), presentacion: z.string().trim().max(40), cantidad: z.number().int().min(1).max(9999) })).max(60);
const deliverySchema = z.enum(["despacho", "retiro", "por_definir"]);
const shippingSchema = z.number().int().min(0).max(10_000_000).nullable();
const prepareSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  tipo_cliente: z.enum(["persona", "negocio"]),
  empresa: z.string().trim().max(140),
  rut: z.string().trim().max(20),
  email: z.union([z.literal(""), z.email().max(160)]),
  telefono: z.string().trim().max(30),
  destino: z.string().trim().max(200),
  entrega: deliverySchema,
  transporte_con_iva: shippingSchema,
  items: itemsSchema.min(1),
  observaciones: z.string().trim().max(1000),
});
const reviseSchema = z.object({ items: itemsSchema, transporte_con_iva: shippingSchema, observaciones: z.string().trim().max(1000) });
const acceptSchema = z.object({ version: z.number().int().min(1) });
const paymentSchema = z.object({
  forma: z.enum(["transferencia", "pagina"]),
  documento: z.enum(["boleta", "factura"]),
  entrega: deliverySchema,
  destino: z.string().trim().max(200),
  transportista: z.string().trim().max(120),
  razon_social: z.string().trim().max(160),
  rut_factura: z.string().trim().max(20),
  giro: z.string().trim().max(160),
  direccion: z.string().trim().max(200),
  comuna: z.string().trim().max(80),
  correo_factura: z.union([z.literal(""), z.email().max(160)]),
  orden_compra: z.string().trim().max(60),
});
const receiptSchema = z.object({ monto: z.number().int().min(0).max(1_000_000_000), pagador: z.string().trim().max(160), fecha: z.string().trim().max(10), titular_destino: z.string().trim().max(160) });

const plain = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/** Lo que el asistente ve de la venta abierta al empezar cada turno. */
export function saleContextLine(sale: Sale | undefined, money: (amount: number) => string) {
  if (!sale) return "No hay cotización abierta en esta conversación.";
  const quote = currentQuote(sale)!;
  return `Venta abierta: ${quoteReference(sale.number, quote.version)}${sale.orderNumber ? ` (pedido ${sale.orderNumber})` : ""}, estado ${saleStatusCodes[sale.status]}, total ${money(quote.totals.total)}${quote.totals.shipping === undefined ? " sin transporte" : ""}, vigente hasta ${quote.validUntil.slice(0, 10)}.`;
}

function present(ctx: SalesToolContext, sale: Sale, extra: Record<string, unknown> = {}) {
  const quote = currentQuote(sale)!;
  return {
    ok: true,
    numero: quoteReference(sale.number, quote.version),
    ...(sale.orderNumber ? { pedido: sale.orderNumber } : {}),
    estado: saleStatusCodes[sale.status],
    cotizacion: quoteText(sale, quote, ctx.deps.money, ctx.formatDate),
    ...extra,
  };
}

async function openSale(ctx: SalesToolContext) {
  const sale = await ctx.deps.repository.findOpenByConversation(ctx.conversationId);
  if (!sale) throw new SaleRuleError("No hay una cotización abierta en esta conversación: prepárala con preparar_cotizacion.");
  return sale;
}

async function notify(ctx: SalesToolContext, notification: SaleNotification) {
  try {
    await ctx.notify?.(notification);
  } catch (error) {
    console.error("store_sales.notify_failed", { saleId: notification.sale.id, message: error instanceof Error ? error.message : "unknown" });
  }
}

/** Ejecuta una herramienta de venta; una regla incumplida llega como SaleRuleError (el modelo la ve como error). */
export async function runSalesTool(name: SalesToolName, input: unknown, ctx: SalesToolContext): Promise<Record<string, unknown>> {
  switch (name) {
    case "preparar_cotizacion": {
      const args = prepareSchema.parse(input);
      if (!ctx.leadId) throw new SaleRuleError("Primero registra al cliente con registrar_pedido (con su autorización de contacto).");
      const existing = await ctx.deps.repository.findOpenByConversation(ctx.conversationId);
      if (existing) throw new SaleRuleError(`Ya hay una cotización abierta (${existing.number}); usa modificar_cotizacion para cambiarla.`);
      // WhatsApp siempre trae el código de país (sin "+"); lo que escribe el cliente puede venir sin él (se asume Chile).
      const sender = ctx.contactPhone ? normalizePhone(ctx.contactPhone.startsWith("+") ? ctx.contactPhone : `+${ctx.contactPhone}`) : undefined;
      const typed = args.telefono ? normalizePhone(args.telefono) : undefined;
      if (args.telefono && !typed) throw new SaleRuleError(`El teléfono "${args.telefono}" no es válido. Pídele un celular chileno (9 1234 5678) o el número con código de país.`);
      const phone = typed ?? sender ?? "";
      if (!phone && !args.email) throw new SaleRuleError("Falta un teléfono o email del cliente para la cotización. Pídeselo.");
      const { sale, problems } = await createQuote(ctx.deps, {
        customer: { name: args.nombre, kind: args.tipo_cliente, company: args.tipo_cliente === "negocio" ? args.empresa : "", taxId: args.rut, phone, email: args.email.toLowerCase() },
        destination: args.destino,
        deliveryMode: args.entrega,
        items: args.items,
        ...(args.transporte_con_iva !== null ? { shipping: args.transporte_con_iva } : {}),
        ...(args.observaciones ? { notes: args.observaciones } : {}),
        leadId: ctx.leadId,
        conversationId: ctx.conversationId,
        via: "assistant",
      });
      await notify(ctx, { kind: "quote", sale });
      return present(ctx, sale, problems.length ? { no_incluido: problems } : {});
    }
    case "modificar_cotizacion": {
      const args = reviseSchema.parse(input);
      const sale = await openSale(ctx);
      const { sale: revised, problems, changes } = await reviseQuote(ctx.deps, sale.id, {
        ...(args.items.length ? { items: args.items } : {}),
        ...(args.transporte_con_iva !== null ? { shipping: args.transporte_con_iva } : {}),
        ...(args.observaciones ? { notes: args.observaciones } : {}),
        via: "assistant",
      });
      return present(ctx, revised, { cambios: changes, nota: "La versión anterior y su aceptación quedaron reemplazadas: pide aceptar esta versión.", ...(problems.length ? { no_incluido: problems } : {}) });
    }
    case "aceptar_cotizacion": {
      const args = acceptSchema.parse(input);
      const sale = await openSale(ctx);
      const accepted = await acceptQuote(ctx.deps, sale.id, { version: args.version, via: "assistant" });
      return { ...present(ctx, accepted), siguiente_paso: "Pregunta si prefiere pagar por transferencia bancaria o mediante la página." };
    }
    case "registrar_forma_de_pago": {
      const args = paymentSchema.parse(input);
      if (args.forma === "pagina" && !ctx.gatewayEnabled) throw new SaleRuleError("El pago en la página todavía no está disponible: ofrece transferencia o deriva a una persona.");
      if (args.forma === "transferencia" && !ctx.transfer) throw new SaleRuleError("No hay datos bancarios configurados: deriva a una persona para coordinar el pago.");
      const sale = await openSale(ctx);
      const order = await choosePayment(ctx.deps, sale.id, {
        method: args.forma === "transferencia" ? "transfer" : "gateway",
        document: args.documento,
        deliveryMode: args.entrega,
        ...(args.destino ? { destination: args.destino } : {}),
        ...(args.transportista ? { carrier: args.transportista } : {}),
        ...(args.documento === "factura" ? { billing: { legalName: args.razon_social, taxId: args.rut_factura, activity: args.giro, address: args.direccion, commune: args.comuna, email: args.correo_factura, phone: "", purchaseOrder: args.orden_compra } } : {}),
        via: "assistant",
      });
      await notify(ctx, { kind: "order", sale: order });
      const total = currentQuote(order)!.totals.total;
      const transfer = ctx.transfer!;
      return present(ctx, order, args.forma === "transferencia" ? {
        datos_transferencia: { titular: transfer.holder, rut: transfer.taxId, banco: transfer.bank, tipo_cuenta: transfer.accountType, numero_cuenta: transfer.accountNumber, correo: transfer.receiptsEmail, monto: ctx.deps.money(total), referencia: order.orderNumber },
        nota: "Entrega estos datos tal cual y pide el comprobante. La venta queda registrada con el pago en revisión hasta que administración confirme el abono.",
      } : {});
    }
    case "registrar_comprobante": {
      const args = receiptSchema.parse(input);
      if (ctx.transfer && args.titular_destino && !plain(args.titular_destino).includes(plain(ctx.transfer.holder)) && !plain(ctx.transfer.holder).includes(plain(args.titular_destino))) {
        throw new SaleRuleError(`El comprobante muestra otro titular de destino ("${args.titular_destino}"). Detén el proceso y deriva a una persona con prioridad alta.`);
      }
      const sale = await openSale(ctx);
      const { sale: inReview, payment, matches } = await registerTransfer(ctx.deps, sale.id, {
        amount: args.monto,
        ...(args.pagador ? { payer: args.pagador } : {}),
        ...(/^\d{4}-\d{2}-\d{2}$/.test(args.fecha) ? { paidOn: args.fecha } : {}),
        receiptRef: `conversación ${ctx.conversationId}`,
        via: "assistant",
      });
      await notify(ctx, { kind: "transfer", sale: inReview, payment, matches });
      return {
        ok: true,
        pedido: inReview.orderNumber,
        estado: saleStatusCodes[inReview.status],
        monto_coincide: matches,
        nota: matches
          ? "Di que recibiste el comprobante, que lo asociaste al pedido y que el pago está en revisión administrativa; avisarán cuando se confirme."
          : `El monto no coincide con el total (${ctx.deps.money(currentQuote(inReview)!.totals.total)}). No pidas otra transferencia: dile que el equipo lo revisará y deriva a una persona.`,
      };
    }
  }
}
