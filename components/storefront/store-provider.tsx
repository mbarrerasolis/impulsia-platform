"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { orderHref, orderMessage, orderTotal } from "@/domain/config/storefront";
import { defaultPriceRules, missingForBulk, priceLines, type LinePricing, type PriceRules } from "@/domain/storefront/pricing";

export interface CartLine {
  /** Producto + presentación (o mix + ingredientes): identifica la línea. */
  id: string;
  name: string;
  /** Código de la presentación en el ERP; viaja en el pedido. */
  sku?: string;
  format?: string;
  price?: number;
  /** Lista por kilo/unidad: el precio de la línea se recalcula con el tramo del producto. */
  pricing?: LinePricing;
  quantity: number;
}

interface StoreContextValue {
  lines: CartLine[];
  units: number;
  total?: number;
  add: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  category: string;
  setCategory: (category: string) => void;
  money: (amount: number) => string;
  checkoutHref: string;
  /** Enlace de envío con datos del cliente agregados al final del mensaje. */
  checkoutHrefWith: (extra: string[]) => string;
  checkoutChannel: "WhatsApp" | "correo";
  /** Último producto agregado, para el aviso breve. */
  lastAdded?: string;
  rules: PriceRules;
  /** Kilos (o unidades) que faltan de ese producto para el precio por volumen. */
  missingForBulk: (pricing: LinePricing) => number | undefined;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore debe usarse dentro de StoreProvider.");
  return value;
}

function readSaved(key: string): CartLine[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) as unknown : [];
    return Array.isArray(parsed) ? parsed.filter((line): line is CartLine => typeof line?.id === "string" && typeof line?.name === "string" && Number.isInteger(line?.quantity) && line.quantity > 0) : [];
  } catch {
    return [];
  }
}

export function StoreProvider({ children, storageKey, greeting, contact, currency, locale, rules = defaultPriceRules }: {
  children: ReactNode;
  storageKey: string;
  greeting: string;
  contact: { whatsappNumber?: string; email: string };
  currency: string;
  locale: string;
  rules?: PriceRules;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [lastAdded, setLastAdded] = useState<string>();

  // El carro sobrevive a recargas en este navegador; si el almacenamiento falla, parte vacío.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee localStorage sólo en el cliente, después de hidratar
    setLines(readSaved(storageKey));
    setLoaded(true);
  }, [storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(lines)); } catch { /* sin almacenamiento: el carro dura la visita */ }
  }, [lines, loaded, storageKey]);
  useEffect(() => {
    if (!lastAdded) return;
    const timer = window.setTimeout(() => setLastAdded(undefined), 2200);
    return () => window.clearTimeout(timer);
  }, [lastAdded]);

  const add = useCallback((line: Omit<CartLine, "quantity">, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((item) => item.id === line.id);
      return existing
        ? current.map((item) => item.id === line.id ? { ...item, quantity: Math.min(99, item.quantity + quantity) } : item)
        : [...current, { ...line, quantity }];
    });
    setLastAdded(line.name);
  }, []);
  const setQuantity = useCallback((id: string, quantity: number) => {
    setLines((current) => quantity <= 0 ? current.filter((item) => item.id !== id) : current.map((item) => item.id === id ? { ...item, quantity: Math.min(99, quantity) } : item));
  }, []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<StoreContextValue>(() => {
    const formatter = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
    const money = (amount: number) => formatter.format(amount);
    // El tramo depende de cuánto hay de cada producto: se recalcula con cada cambio del carro.
    const priced = priceLines(lines, rules);
    const sizes = new Map<string, number>();
    for (const line of lines) if (line.pricing) sizes.set(line.pricing.productKey, (sizes.get(line.pricing.productKey) ?? 0) + line.pricing.size * line.quantity);
    const total = orderTotal(priced);
    const message = orderMessage(greeting, priced, money) + (total ? `\nTotal: ${money(total)} (IVA incluido)` : "");
    return {
      lines: priced, add, setQuantity, clear, cartOpen, setCartOpen, query, setQuery, category, setCategory, money, lastAdded, rules,
      missingForBulk: (pricing: LinePricing) => missingForBulk(pricing, sizes.get(pricing.productKey) ?? 0, rules),
      units: lines.reduce((sum, line) => sum + line.quantity, 0),
      total,
      checkoutHref: orderHref(message, contact),
      checkoutHrefWith: (extra: string[]) => orderHref(extra.length ? `${message}\n\n${extra.join("\n")}` : message, contact),
      checkoutChannel: contact.whatsappNumber ? "WhatsApp" : "correo",
    };
  }, [lines, add, setQuantity, clear, cartOpen, query, category, lastAdded, locale, currency, greeting, contact, rules]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
