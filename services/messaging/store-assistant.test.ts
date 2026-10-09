import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { parseStorefront } from "@/domain/config/storefront";
import type { AssistantActions, AssistantLeadInput, AssistantModelClient } from "./sales-assistant";
import { buildStoreAssistantPrompt, StoreAssistant, storeAssistantTools } from "./store-assistant";

const storefront = parseStorefront({
  catalogEyebrow: "Catálogo",
  catalogTitle: "Frutos secos",
  catalogDescription: "Todo lo que vendemos, por kilo.",
  categories: [{ key: "frutos-secos", name: "Frutos secos" }],
  products: [{ key: "almendra", name: "Almendra Nonpareil", category: "frutos-secos", sku: "12-11", net: { base: 12999, bulk: 10990 }, formats: [{ label: "500 g", grams: 500 }, { label: "1 kg", grams: 1000 }] }],
  highlights: [{ title: "Despacho", text: "A todo Chile con transporte asociado." }],
  howToBuyTitle: "Cómo comprar",
  howToBuy: [{ title: "Elige", text: "Arma tu pedido en el carro." }],
  orderGreeting: "Hola, quiero hacer este pedido:",
  deliveryNote: "El costo depende del destino y del peso; se informa antes de confirmar.",
  pricing: { wholesaleMinimum: 3 },
  assistant: { name: "Claudia", about: "Comercializadora Secos vende frutos secos por kilo con despacho a todo Chile.", style: ["Cálida y breve."], policies: ["Se emite boleta o factura."] },
});

const config = { model: "claude-sonnet-5", brandName: "Comercializadora Secos", contactEmail: "contacto@distribuidorasecos.cl", locale: "es-CL", currency: "CLP", siteUrl: "https://distribuidorasecos.cl", storefront, loadStorefront: async () => storefront };
const usage = { input_tokens: 1_000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const text = (value: string) => ({ content: [{ type: "text", text: value }], stop_reason: "end_turn", usage }) as unknown as Anthropic.Message;
const tool = (name: string, input: unknown) => ({ content: [{ type: "tool_use", id: `toolu_${name}`, name, input }], stop_reason: "tool_use", usage }) as unknown as Anthropic.Message;

function fakeClient(...responses: Anthropic.Message[]) {
  const create = vi.fn<AssistantModelClient["create"]>();
  for (const response of responses) create.mockResolvedValueOnce(response);
  return { create };
}
const actions = () => ({ registerLead: vi.fn<(lead: AssistantLeadInput) => Promise<{ leadId: string }>>(async () => ({ leadId: "lead_1" })), requestHandoff: vi.fn(async () => {}), proposeQuote: vi.fn(async () => {}) }) satisfies AssistantActions;
const toolResult = (client: ReturnType<typeof fakeClient>, call: number) => {
  const block = (client.create.mock.calls[call][0].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
  return JSON.parse(block.content as string);
};

const order = { nombre: "Carolina", ciudad: "Ñuñoa", tipo_cliente: "Particular", empresa: "", rut: "", email: "", telefono: "", uso: "Consumo personal", nivel: "PRIORITARIO", frecuencia: "", fecha_requerida: "", items: [{ clave: "almendra", presentacion: "1 kg", cantidad: 6 }], comentarios: "" };

describe("StoreAssistant", () => {
  it("arma el prompt con la identidad, el estilo y las reglas de la tienda", () => {
    const prompt = buildStoreAssistantPrompt(config);
    expect(prompt).toContain("Eres Claudia, la asistente de Comercializadora Secos");
    expect(prompt).toContain("Cálida y breve.");
    expect(prompt).toContain("Se emite boleta o factura.");
    expect(prompt).toContain("desde 3 kg por producto");
    expect(storeAssistantTools.map((item) => item.name)).toEqual(["buscar_productos", "cotizar_pedido", "registrar_pedido", "derivar_a_humano"]);
  });

  it("busca en el catálogo con precio y tramo", async () => {
    const client = fakeClient(tool("buscar_productos", { consulta: "almendras" }), text("Tenemos almendra Nonpareil."));
    const result = await new StoreAssistant(client, config).runTurn({ history: [], message: "¿tienen almendras?" }, actions());
    expect(result.reply).toBe("Tenemos almendra Nonpareil.");
    const found = toolResult(client, 1).productos[0];
    expect(found.presentaciones[1]).toEqual({ presentacion: "1 kg", precio_con_iva: expect.stringContaining("15.470"), stock: "disponible" });
    expect(found.enlace).toBe("https://distribuidorasecos.cl/productos/almendra");
  });

  it("no registra sin consentimiento y registra el pedido con el tramo aplicado", async () => {
    const denied = actions();
    const client1 = fakeClient(tool("registrar_pedido", { ...order, consentimiento_explicito: false }), text("¿Me autorizas?"));
    await new StoreAssistant(client1, config).runTurn({ history: [], message: "quiero 6 kg" }, denied);
    expect(denied.registerLead).not.toHaveBeenCalled();
    expect(toolResult(client1, 1).ok).toBe(false);

    const allowed = actions();
    const client2 = fakeClient(tool("registrar_pedido", { ...order, consentimiento_explicito: true }), text("¡Listo!"));
    const result = await new StoreAssistant(client2, config).runTurn({ history: [], message: "sí, autorizo" }, allowed);
    expect(result.leadCreated).toBe(true);
    const lead = allowed.registerLead.mock.calls[0][0];
    expect(lead).toMatchObject({ name: "Carolina", company: "Particular", email: "", goal: "Pedido en tienda", interest: "alto" });
    expect(lead.need).toContain("Destino: Ñuñoa");
    expect(lead.need).toContain("Particular · uso: Consumo personal · nivel: PRIORITARIO");
    expect(lead.need).toContain("6 × Almendra Nonpareil (1 kg) [12-11] — $78.480");
  });

  it("registra negocios con RUT, nivel y el teléfono normalizado desde el chat del sitio", async () => {
    const allowed = actions();
    const client = fakeClient(tool("registrar_pedido", { ...order, tipo_cliente: "Panadería o pastelería", empresa: "Panadería Sol", rut: "76.123.456-7", telefono: "+56 9 8765-4321", uso: "Elaboración de alimentos", nivel: "RECURRENTE_POTENCIAL", consentimiento_explicito: true }), text("Listo"));
    await new StoreAssistant(client, config).runTurn({ channel: "web", history: [], message: "sí" }, allowed);
    expect(allowed.registerLead.mock.calls[0][0]).toMatchObject({ company: "Panadería Sol", goal: "Compra mayorista", interest: "medio", phone: "+56987654321" });
    expect(allowed.registerLead.mock.calls[0][0].need).toContain("RUT: 76.123.456-7");
  });

  it("usa la identidad, el saludo y los datos bancarios configurados", () => {
    const prompt = buildStoreAssistantPrompt({ ...config, storefront: { ...storefront, assistant: { ...storefront.assistant!, identity: "Eres el vendedor digital oficial de Secos SpA.", aiDisclosure: "Soy el vendedor virtual de Secos SpA.", greeting: "¡Hola! Bienvenido a Secos SpA." }, transfer: { holder: "Secos SpA", taxId: "11.111.111-1", bank: "Banco Santander", accountType: "Cuenta Corriente", accountNumber: "0-000-0000000-0", receiptsEmail: "contacto@distribuidorasecos.cl" } } });
    expect(prompt.startsWith("Eres el vendedor digital oficial de Secos SpA.")).toBe(true);
    expect(prompt).toContain("responde: \"Soy el vendedor virtual de Secos SpA.\" Si insiste o pregunta si eres una inteligencia artificial, confírmalo con claridad. Nunca afirmes ser una persona humana");
    expect(prompt).toContain("saluda así: \"¡Hola! Bienvenido a Secos SpA.\"");
    expect(prompt).toContain("• Número de cuenta: 0-000-0000000-0");
  });
});
