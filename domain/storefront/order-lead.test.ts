import { describe, expect, it } from "vitest";
import { parseStorefront } from "@/domain/config/storefront";
import { buildOrderLead, orderLeadSchema, orderLeadScore } from "./order-lead";

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
  mix: { title: "Arma tu mix", description: "Elige ingredientes y lo pesamos.", grams: 1000, ingredients: [{ key: "nuez", name: "Nuez", color: "#B07A45", pricePerKg: 9750 }, { key: "goji", name: "Goji", color: "#E2492B", pricePerKg: 11310 }] },
});
const money = (amount: number) => `$${amount.toLocaleString("es-CL")}`;
const base = { name: "Carolina Muñoz", phone: "+56 9 1234 5678", city: "Ñuñoa", customerType: "persona", items: [{ id: "almendra::1 kg", quantity: 6 }, { id: "mix::nuez+goji", quantity: 1 }], channel: "whatsapp", consentGiven: true };

describe("lead de pedido de la tienda", () => {
  it("valida datos mínimos y exige el negocio cuando compra para uno", () => {
    expect(orderLeadSchema.safeParse(base).success).toBe(true);
    expect(orderLeadSchema.safeParse({ ...base, customerType: "negocio" }).success).toBe(false);
    expect(orderLeadSchema.safeParse({ ...base, phone: "123" }).success).toBe(false);
    expect(orderLeadSchema.safeParse({ ...base, consentGiven: false }).success).toBe(false);
  });

  it("recalcula el pedido en el servidor, con tramo y mix", () => {
    const { lead, total } = buildOrderLead(storefront, orderLeadSchema.parse(base), money);
    expect(total).toBe(6 * 13080 + 10530);
    expect(lead).toMatchObject({ source: "web", company: "Particular", email: "", phone: "+56912345678", primaryGoal: "Pedido en tienda", score: 55 });
    expect(lead.rawNeedDescription).toContain("despacho: Ñuñoa");
    expect(lead.rawNeedDescription).toContain("6 × Almendra Nonpareil (1 kg) — $78.480");
    expect(lead.rawNeedDescription).toContain("Mix a medida (Nuez 500 g, Goji 500 g) — $10.530");
  });

  it("puntúa más alto los pedidos grandes y de negocios", () => {
    expect(orderLeadScore(undefined, "persona")).toBe(35);
    expect(orderLeadScore(150_000, "negocio")).toBe(85);
  });
});
