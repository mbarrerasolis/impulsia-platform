import type Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseStorefront } from "@/domain/config/storefront";
import { MemorySaleRepository } from "@/repositories/memory/memory-sale-repository";
import type { AssistantActions, AssistantModelClient } from "./sales-assistant";
import { buildStoreAssistantPrompt, StoreAssistant } from "./store-assistant";
import type { SaleNotification } from "./store-sales-tools";

const storefront = parseStorefront({
  catalogEyebrow: "Catálogo",
  catalogTitle: "Frutos secos",
  catalogDescription: "Todo lo que vendemos, por kilo.",
  categories: [{ key: "frutos-secos", name: "Frutos secos" }],
  products: [{ key: "almendra", name: "Almendra Nonpareil", category: "frutos-secos", net: { base: 12999, bulk: 10990 }, formats: [{ label: "500 g", grams: 500 }, { label: "1 kg", grams: 1000 }] }],
  highlights: [{ title: "Despacho", text: "A todo Chile con transporte asociado." }],
  howToBuyTitle: "Cómo comprar",
  howToBuy: [{ title: "Elige", text: "Arma tu pedido en el carro." }],
  orderGreeting: "Hola, quiero hacer este pedido:",
  transfer: { holder: "Secos SpA", taxId: "11.111.111-1", bank: "Banco Santander", accountType: "Cuenta Corriente", accountNumber: "0-000-0000000-0", receiptsEmail: "contacto@distribuidorasecos.cl" },
  assistant: { name: "Andrea", about: "Secos SpA vende frutos secos por kilo." },
});

const repository = new MemorySaleRepository();
const year = new Date().getFullYear();
const notifications: SaleNotification[] = [];
const config = {
  model: "claude-sonnet-5", brandName: "Secos SpA", contactEmail: "contacto@distribuidorasecos.cl", locale: "es-CL", currency: "CLP", siteUrl: "https://distribuidorasecos.cl",
  storefront, loadStorefront: async () => storefront,
  sales: { repository, gatewayEnabled: false, notify: async (notification: SaleNotification) => { notifications.push(notification); } },
};
const usage = { input_tokens: 1_000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const text = (value: string) => ({ content: [{ type: "text", text: value }], stop_reason: "end_turn", usage }) as unknown as Anthropic.Message;
const tool = (name: string, input: unknown) => ({ content: [{ type: "tool_use", id: `toolu_${name}`, name, input }], stop_reason: "tool_use", usage }) as unknown as Anthropic.Message;
const actions = (): AssistantActions => ({ registerLead: async () => ({ leadId: "lead_1" }), requestHandoff: async () => {}, proposeQuote: async () => {} });

/** Corre un turno en que el modelo llama una herramienta y devuelve lo que ésta respondió. */
async function callTool(name: string, input: unknown, turn: { existingLeadId?: string | null; conversationId?: string; contactPhone?: string } = {}) {
  const create = vi.fn<AssistantModelClient["create"]>().mockResolvedValueOnce(tool(name, input)).mockResolvedValueOnce(text("Listo."));
  await new StoreAssistant({ create }, config).runTurn({ channel: "whatsapp", history: [], message: "hola", existingLeadId: "lead_1", conversationId: "conv-1", contactPhone: "+56911112222", ...turn }, actions());
  const block = (create.mock.calls[1][0].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
  return { result: JSON.parse(block.content as string), isError: Boolean(block.is_error), tools: create.mock.calls[0][0].tools!.map((item) => (item as Anthropic.Tool).name), system: create.mock.calls[0][0].system as Anthropic.TextBlockParam[] };
}

const quoteInput = { nombre: "Ana Pérez", tipo_cliente: "negocio", empresa: "Almacén Ana", rut: "76.123.456-7", email: "", telefono: "", destino: "Temuco, La Araucanía", entrega: "retiro", transporte_con_iva: null, items: [{ clave: "almendra", presentacion: "1 kg", cantidad: 2 }], observaciones: "" };
const paymentInput = { forma: "transferencia", documento: "boleta", entrega: "retiro", destino: "", transportista: "", razon_social: "", rut_factura: "", giro: "", direccion: "", comuna: "", correo_factura: "", orden_compra: "" };

describe("herramientas de venta de la vendedora virtual", () => {
  beforeEach(() => {
    MemorySaleRepository.reset();
    notifications.length = 0;
  });

  it("sólo ofrece las herramientas de venta con conversación guardada, y el prompt explica las reglas", async () => {
    expect((await callTool("buscar_productos", { consulta: "almendra" })).tools).toContain("preparar_cotizacion");
    expect((await callTool("buscar_productos", { consulta: "almendra" }, { conversationId: undefined })).tools).not.toContain("preparar_cotizacion");
    const prompt = buildStoreAssistantPrompt(config);
    expect(prompt).toContain("COT-AAAA-NNNNN-Vn");
    expect(prompt).toContain("el pago en la página aún no está disponible");
    expect(prompt).not.toContain("Todavía no hay cotizaciones numeradas");
  });

  it("no suma herramientas estrictas: la API rechaza la gramática si crece demasiado", async () => {
    const create = vi.fn<AssistantModelClient["create"]>().mockResolvedValueOnce(text("Hola."));
    await new StoreAssistant({ create }, config).runTurn({ channel: "web", history: [], message: "hola", conversationId: "conv-1" }, actions());
    const tools = create.mock.calls[0][0].tools as Anthropic.Tool[];
    expect(tools.filter((item) => item.strict).map((item) => item.name)).toEqual(["buscar_productos", "cotizar_pedido", "registrar_pedido", "derivar_a_humano"]);
  });

  it("usa el teléfono de WhatsApp (también de otro país) y valida el que escribe el cliente", async () => {
    await callTool("preparar_cotizacion", quoteInput, { contactPhone: "+5491123456789" });
    expect((await repository.findOpenByConversation("conv-1"))!.customer.phone).toBe("+5491123456789");

    const invalid = await callTool("preparar_cotizacion", { ...quoteInput, telefono: "mi celular" }, { conversationId: "conv-2", contactPhone: undefined });
    expect(invalid.isError).toBe(true);
    expect(invalid.result.error).toContain("no es válido");
    await callTool("preparar_cotizacion", { ...quoteInput, telefono: "9 8765 4321" }, { conversationId: "conv-2", contactPhone: undefined });
    expect((await repository.findOpenByConversation("conv-2"))!.customer.phone).toBe("+56987654321");

    const noContact = await callTool("preparar_cotizacion", quoteInput, { conversationId: "conv-3", contactPhone: undefined });
    expect(noContact.result.error).toContain("teléfono o email");
  });

  it("exige el registro del cliente antes de cotizar", async () => {
    const { result, isError } = await callTool("preparar_cotizacion", quoteInput, { existingLeadId: null });
    expect(isError).toBe(true);
    expect(result.error).toContain("registrar_pedido");
  });

  it("lleva la venta de la cotización al comprobante en revisión, avisando al equipo", async () => {
    const quoted = await callTool("preparar_cotizacion", quoteInput);
    expect(quoted.result).toMatchObject({ ok: true, numero: `COT-${year}-00001-V1`, estado: "COTIZACIÓN_ENVIADA" });
    expect(quoted.result.cotizacion).toContain("Neto: $26.000");
    expect(notifications.map((item) => item.kind)).toEqual(["quote"]);
    const sale = (await repository.findOpenByConversation("conv-1"))!;
    expect(sale.customer.phone).toBe("+56911112222");

    const again = await callTool("preparar_cotizacion", quoteInput);
    expect(again.result.error).toContain("modificar_cotizacion");
    expect((await callTool("aceptar_cotizacion", { version: 1 })).system[1].text).toContain(`Venta abierta: COT-${year}-00001-V1`);

    const revised = await callTool("modificar_cotizacion", { items: [{ clave: "almendra", presentacion: "1 kg", cantidad: 6 }], transporte_con_iva: null, observaciones: "" });
    expect(revised.result).toMatchObject({ numero: `COT-${year}-00001-V2`, estado: "COTIZACIÓN_MODIFICADA", cambios: "Almendra Nonpareil 1 kg: 2 → 6" });
    expect((await callTool("aceptar_cotizacion", { version: 1 })).result.error).toContain("fue reemplazada");
    expect((await callTool("aceptar_cotizacion", { version: 2 })).result.estado).toBe("COTIZACIÓN_ACEPTADA");

    const gateway = await callTool("registrar_forma_de_pago", { ...paymentInput, forma: "pagina" });
    expect(gateway.result.error).toContain("todavía no está disponible");
    const order = await callTool("registrar_forma_de_pago", paymentInput);
    expect(order.result).toMatchObject({ pedido: `PED-${year}-00001`, estado: "PAGO_PENDIENTE", datos_transferencia: { titular: "Secos SpA", numero_cuenta: "0-000-0000000-0", monto: "$78.480", referencia: `PED-${year}-00001` } });

    const wrongHolder = await callTool("registrar_comprobante", { monto: 78480, pagador: "Ana Pérez", fecha: "2026-10-08", titular_destino: "Juan Soto" });
    expect(wrongHolder.result.error).toContain("otro titular");
    const receipt = await callTool("registrar_comprobante", { monto: 78480, pagador: "Ana Pérez", fecha: "2026-10-08", titular_destino: "SECOS SPA" });
    expect(receipt.result).toMatchObject({ ok: true, pedido: `PED-${year}-00001`, estado: "VENTA_REGISTRADA_PAGO_EN_REVISIÓN", monto_coincide: true });
    expect(notifications.map((item) => item.kind)).toEqual(["quote", "order", "transfer"]);
    expect((await repository.findByNumber(`PED-${year}-00001`))!.payments[0]).toMatchObject({ status: "in_review", amount: 78480, paidOn: "2026-10-08", receiptRef: "conversación conv-1" });
  });
});
