import { z } from "zod";
import { stockStatuses } from "@/domain/storefront/stock";
import { grossPrice, productPricing, type PriceRules } from "@/domain/storefront/pricing";

/**
 * Vitrina de productos de una edición que vende productos (`business.offering` products o mixed,
 * módulo `store`). Mientras no exista el pago en línea (fase B), el carro arma el pedido y lo envía
 * por WhatsApp o correo; los precios son opcionales ("a consultar").
 */
const keySchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa minúsculas, números y guiones.").max(80);
const publicImageSchema = z.string().trim().regex(/^\/[A-Za-z0-9/_.-]+\.(png|jpe?g|webp|svg)$/i, "Debe ser una imagen dentro de /public.");
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color #RRGGBB.");
const priceSchema = z.number().int().positive().max(100_000_000);
/** Código de la presentación en el ERP (FrutoFlow u otro): une catálogo, stock y ventas. */
const skuSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/, "SKU: letras, números, punto, guion o guion bajo (máx. 40).");

/** Texturas de grano que reemplazan la foto mientras no exista (ver app/storefront.css). */
export const textures = ["nuez", "mani", "quinoa", "lenteja", "chia", "garbanzo", "arandano", "choco", "harina", "pasa", "semilla"] as const;
export type Texture = (typeof textures)[number];

const formatSchema = z.object({
  /** Presentación tal como se vende: "500 g", "1 kg", "granel". */
  label: z.string().trim().min(1).max(40),
  /** Precio en la moneda de la edición (entero); si falta, se muestra "a consultar". */
  price: priceSchema.optional(),
  sku: skuSchema.optional(),
  /** Gramos de la presentación, para calcular su precio desde el precio por kilo de la lista. */
  grams: z.number().int().positive().max(100_000).optional(),
  /** Lo calcula el inventario de la base; en el manifiesto sólo "out" (sin stock en la lista). */
  stock: z.enum(stockStatuses).optional(),
});

const productSchema = z.object({
  key: keySchema,
  name: z.string().trim().min(2).max(120),
  category: keySchema,
  /** SKU del producto cuando no tiene presentaciones; con presentaciones, cada una lleva el suyo. */
  sku: skuSchema.optional(),
  /** Precio del producto cuando no tiene presentaciones (normalmente viene del inventario). */
  price: priceSchema.optional(),
  /** Lo calcula el inventario de la base; en el manifiesto sólo "out" (sin stock en la lista). */
  stock: z.enum(stockStatuses).optional(),
  /**
   * Lista de precios NETOS (sin impuesto) por kilo, o por unidad si `unit` existe: `base` hasta el
   * tramo por volumen y `bulk` desde `pricing.bulkFrom`. El sitio calcula cada presentación con impuesto.
   */
  net: z.object({ base: priceSchema, bulk: priceSchema.optional() }).optional(),
  /** Se vende por unidad ("bolsa de 500 g", "frasco de 220 ml") en vez de por kilo. */
  unit: z.string().trim().min(2).max(40).optional(),
  description: z.string().trim().min(3).max(300).optional(),
  formats: z.array(formatSchema).max(8).default([]),
  /** Etiquetas cortas: "sin gluten", "vegano", "22 sabores". */
  tags: z.array(z.string().trim().min(2).max(30)).max(5).default([]),
  image: publicImageSchema.optional(),
  /** La foto no es del producto exacto (banco de imágenes o de un sabor parecido): se avisa en la ficha. */
  imageIsReferential: z.boolean().default(false),
  /** Afiche vertical con título y sello (portada y novedades). */
  poster: publicImageSchema.optional(),
  texture: z.enum(textures).optional(),
  /** Aparece en "Los más pedidos". */
  featured: z.boolean().default(false),
});

const categorySchema = z.object({
  key: keySchema,
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().min(3).max(200).optional(),
  /** Color de la tarjeta de categoría y de las etiquetas de sus productos. */
  color: colorSchema.optional(),
  /** Texto oscuro sobre el color (para colores claros como el trigo). */
  darkText: z.boolean().default(false),
  image: publicImageSchema.optional(),
  texture: z.enum(textures).optional(),
});

const cardSchema = z.object({
  title: z.string().trim().min(3).max(80),
  text: z.string().trim().min(10).max(300),
});

const mixSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(240),
  /** Peso del mix en gramos (se reparte en partes iguales). */
  grams: z.number().int().min(100).max(10_000).default(1000),
  /**
   * Mix para negocios: `pricePerKg` de cada ingrediente es NETO (sin impuesto) y el armador muestra
   * neto + IVA; en el carro va con impuesto, como el resto del pedido.
   */
  wholesale: z.boolean().default(false),
  /**
   * Mix a medida: el cliente elige cuántos gramos lleva de cada ingrediente (mínimo este valor, en pasos
   * de `stepGrams`) y `grams` pasa a ser el mínimo del total. Sin él, el mix se reparte en partes iguales.
   */
  minIngredientGrams: z.number().int().min(50).max(10_000).optional(),
  stepGrams: z.number().int().min(10).max(1_000).default(100),
  maxItems: z.number().int().min(2).max(8).default(5),
  ingredients: z.array(z.object({
    key: keySchema,
    name: z.string().trim().min(2).max(60),
    pricePerKg: priceSchema.optional(),
    color: colorSchema,
    image: publicImageSchema.optional(),
    texture: z.enum(textures).optional(),
  })).min(2).max(16),
});

const wholesaleSchema = z.object({
  title: z.string().trim().min(3).max(120),
  text: z.string().trim().min(10).max(400),
  /** Pedido mínimo neto, en la moneda de la edición. */
  minimumOrderNet: priceSchema.optional(),
  ctaLabel: z.string().trim().min(3).max(60),
  ctaMessage: z.string().trim().min(5).max(240),
});

/** Sólo reseñas reales de clientes (con su permiso); sin reseñas, la sección no aparece. */
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(5).max(400),
  author: z.string().trim().min(2).max(60),
  product: z.string().trim().min(2).max(120).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const instagramSchema = z.object({
  handle: z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/, "Usuario de Instagram sin @."),
  reels: z.array(z.object({
    url: z.url(),
    title: z.string().trim().min(3).max(80),
    image: publicImageSchema.optional(),
    texture: z.enum(textures).optional(),
    /** Producto que aparece en el video: agrega su botón de compra. */
    product: keySchema.optional(),
  })).max(10).default([]),
});

export const storefrontSchema = z.object({
  /** Logo de la marca (imagen dentro de /public); si falta, el encabezado muestra el nombre. */
  logo: z.object({
    src: publicImageSchema,
    alt: z.string().trim().min(3).max(120),
    width: z.number().int().positive().max(4000),
    height: z.number().int().positive().max(4000),
  }).optional(),
  /** Isotipo cuadrado (imagen dentro de /public) para el pie y los íconos. */
  emblem: publicImageSchema.optional(),
  /** Barra de anuncio sobre el encabezado. */
  announcement: z.string().trim().min(5).max(140).optional(),
  heroImages: z.array(z.object({ image: publicImageSchema.optional(), texture: z.enum(textures).optional(), caption: z.string().trim().min(2).max(60).optional(), detail: z.string().trim().min(2).max(60).optional() })).max(3).default([]),
  /** Búsquedas sugeridas bajo el buscador. */
  suggestions: z.array(z.string().trim().min(2).max(40)).max(6).default([]),
  catalogEyebrow: z.string().trim().min(2).max(60),
  catalogTitle: z.string().trim().min(3).max(120),
  catalogDescription: z.string().trim().min(10).max(300),
  categories: z.array(categorySchema).min(1).max(20),
  products: z.array(productSchema).min(1).max(500),
  highlights: z.array(cardSchema).min(1).max(4),
  howToBuyTitle: z.string().trim().min(3).max(120),
  howToBuy: z.array(cardSchema).min(1).max(4),
  mix: mixSchema.optional(),
  wholesale: wholesaleSchema.optional(),
  reviews: z.array(reviewSchema).max(200).default([]),
  instagram: instagramSchema.optional(),
  /** Despacho, retiro y horarios; un párrafo corto. */
  deliveryNote: z.string().trim().min(10).max(400).optional(),
  deliveryTitle: z.string().trim().min(3).max(120).optional(),
  /** Ciudades de norte a sur para dibujar el recorrido del despacho. */
  deliveryStops: z.array(z.string().trim().min(2).max(40)).max(10).default([]),
  /** Primera línea del mensaje de pedido por WhatsApp. */
  orderGreeting: z.string().trim().min(5).max(160),
  /**
   * Asistente de la tienda (WhatsApp y chat del sitio): identidad, estilo y lo que puede afirmar.
   * Todo lo que diga sobre la empresa, despacho o pagos debe salir de aquí o del catálogo.
   */
  assistant: z.object({
    /** Nombre con que se presenta ("Claudia"); sin él, "el asistente de <marca>". */
    name: z.string().trim().min(2).max(60).optional(),
    /** Identidad y rol en primera línea del prompt ("Eres el vendedor digital oficial de…"); reemplaza la genérica. */
    identity: z.string().trim().min(20).max(1500).optional(),
    /** Respuesta exacta si preguntan si es una persona, un bot o una IA (nunca afirma ser humano). */
    aiDisclosure: z.string().trim().min(20).max(500).optional(),
    /** Saludo cuando el cliente todavía no explicó qué necesita. */
    greeting: z.string().trim().min(10).max(500).optional(),
    /** Secciones del manual de ventas (calificación, transporte, facturación, reclamos, reglas…). */
    playbook: z.array(z.object({ title: z.string().trim().min(3).max(80), text: z.string().trim().min(10).max(3000) })).max(20).default([]),
    /** Tono y forma de escribir (personalidad, expresiones, emojis sí/no, largo de los mensajes). */
    style: z.array(z.string().trim().min(5).max(400)).max(20).default([]),
    /** Quiénes somos, en pocas frases. */
    about: z.string().trim().min(20).max(1200),
    /** Reglas del negocio que puede comunicar: despacho, retiro, pagos, mínimos, horarios, boleta/factura. */
    policies: z.array(z.string().trim().min(5).max(400)).max(20).default([]),
    faqs: z.array(z.object({ question: z.string().trim().min(5).max(200), answer: z.string().trim().min(5).max(600) })).max(30).default([]),
    /** Lo que no debe prometer ni decir. */
    limits: z.array(z.string().trim().min(5).max(300)).max(15).default([]),
  }).optional(),
  /** Datos bancarios oficiales para transferencias (el asistente los entrega tal cual; nunca otros). */
  transfer: z.object({
    holder: z.string().trim().min(2).max(120),
    taxId: z.string().trim().min(3).max(20),
    bank: z.string().trim().min(2).max(80),
    accountType: z.string().trim().min(2).max(60),
    accountNumber: z.string().trim().min(3).max(40),
    receiptsEmail: z.email(),
    /** Copia administrativa de los comprobantes (no se muestra al cliente). */
    receiptsCc: z.email().optional(),
  }).optional(),
  /** Reglas para pasar de la lista neta a precio público (ver domain/storefront/pricing.ts). */
  pricing: z.object({
    taxRate: z.number().min(0).max(1).default(0.19),
    bulkFrom: z.number().positive().max(1000).default(6),
    roundTo: z.number().int().min(1).max(1000).default(10),
    /** Compra mínima por producto para comprar como mayorista (informativo). */
    wholesaleMinimum: z.number().positive().max(1000).optional(),
  }).default({ taxRate: 0.19, bulkFrom: 6, roundTo: 10 }),
}).superRefine((value, context) => {
  const categories = new Set(value.categories.map((category) => category.key));
  const seen = new Set<string>();
  const skus = new Set<string>();
  const claimSku = (sku: string | undefined, path: (string | number)[]) => {
    if (!sku) return;
    const normalized = sku.toUpperCase();
    if (skus.has(normalized)) context.addIssue({ code: "custom", path, message: `SKU duplicado: ${sku}.` });
    skus.add(normalized);
  };
  value.products.forEach((product, index) => {
    claimSku(product.sku, ["products", index, "sku"]);
    product.formats.forEach((format, formatIndex) => claimSku(format.sku, ["products", index, "formats", formatIndex, "sku"]));
    if (!categories.has(product.category)) context.addIssue({ code: "custom", path: ["products", index, "category"], message: `La categoría ${product.category} no existe.` });
    if (seen.has(product.key)) context.addIssue({ code: "custom", path: ["products", index, "key"], message: `Producto duplicado: ${product.key}.` });
    seen.add(product.key);
  });
  value.instagram?.reels.forEach((reel, index) => {
    if (reel.product && !seen.has(reel.product)) context.addIssue({ code: "custom", path: ["instagram", "reels", index, "product"], message: `El producto ${reel.product} no existe.` });
  });
});

export type Storefront = z.infer<typeof storefrontSchema>;
export type StoreProduct = Storefront["products"][number];
export type StoreCategory = Storefront["categories"][number];
export type StoreMix = NonNullable<Storefront["mix"]>;

export function parseStorefront(source: unknown): Storefront {
  return storefrontSchema.parse(source);
}

/** Categorías en el orden del manifiesto, sólo las que tienen productos. */
export function groupProducts(storefront: Pick<Storefront, "categories" | "products">) {
  return storefront.categories
    .map((category) => ({ category, products: storefront.products.filter((product) => product.category === category.key) }))
    .filter((group) => group.products.length > 0);
}

/** Productos destacados; si no hay ninguno marcado, el primero de cada categoría. */
export function featuredProducts(storefront: Pick<Storefront, "categories" | "products">, limit = 8) {
  const marked = storefront.products.filter((product) => product.featured);
  const list = marked.length ? marked : groupProducts(storefront).map((group) => group.products[0]);
  return list.slice(0, limit);
}

/** Promedio con un decimal y cantidad; `undefined` sin reseñas. */
export function reviewSummary(reviews: Storefront["reviews"]) {
  if (!reviews.length) return undefined;
  const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  return { average: Math.round(average * 10) / 10, count: reviews.length };
}

/**
 * Reparto en partes iguales y precio del mix. `price` es el precio al público (con impuesto si el mix
 * es mayorista y se pasan las reglas); `net` es el neto de un mix mayorista.
 */
export function mixQuote(mix: Pick<StoreMix, "grams" | "ingredients"> & { wholesale?: boolean }, keys: string[], rules?: PriceRules): { parts: (StoreMix["ingredients"][number] & { grams: number })[]; price?: number; net?: number } {
  const chosen = mix.ingredients.filter((ingredient) => keys.includes(ingredient.key));
  if (!chosen.length) return { parts: [], price: undefined };
  const grams = Math.floor(mix.grams / chosen.length);
  const parts = chosen.map((ingredient, index) => ({ ...ingredient, grams: index === 0 ? mix.grams - grams * (chosen.length - 1) : grams }));
  const priced = parts.every((part) => part.pricePerKg);
  const listed = priced ? parts.reduce((sum, part) => sum + (part.pricePerKg ?? 0) * part.grams / 1000, 0) : undefined;
  if (listed === undefined) return { parts, price: undefined };
  if (mix.wholesale && rules) return { parts, net: Math.round(listed), price: grossPrice(listed, 1, rules) };
  return { parts, price: Math.round(listed / 10) * 10 };
}

type PricedFormat = Pick<StoreProduct["formats"][number], "price" | "grams">;

/**
 * Lista de una presentación cuando su precio sale de la lista por kilo/unidad. Un precio fijo
 * (manifiesto o inventario) manda sobre la lista y entonces no hay tramo.
 */
export function formatPricing(product: Pick<StoreProduct, "key" | "unit" | "net" | "price">, format?: PricedFormat) {
  if (format ? format.price : product.price) return undefined;
  return productPricing(product, format?.grams);
}

/** Precio público de una presentación en el tramo base; `undefined` = "a consultar". */
export function formatPrice(product: Pick<StoreProduct, "key" | "unit" | "net" | "price">, format: PricedFormat | undefined, rules: PriceRules) {
  const fixed = format ? format.price : product.price;
  if (fixed) return fixed;
  const pricing = productPricing(product, format?.grams);
  return pricing ? grossPrice(pricing.base, pricing.size, rules) : undefined;
}

/** Precio público por kilo (o unidad) en cada tramo, para la ficha y la lista mayorista. */
export function tierPrices(product: Pick<StoreProduct, "net">, rules: PriceRules) {
  if (!product.net) return undefined;
  return {
    base: grossPrice(product.net.base, 1, rules),
    bulk: product.net.bulk && product.net.bulk < product.net.base ? grossPrice(product.net.bulk, 1, rules) : undefined,
  };
}

/** SKU de una presentación (o del producto si no tiene presentaciones). */
export function skuFor(product: Pick<StoreProduct, "sku" | "formats">, formatLabel?: string) {
  return product.formats.find((format) => format.label === formatLabel)?.sku ?? product.sku;
}

export interface OrderLine {
  name: string;
  sku?: string;
  format?: string;
  quantity: number;
  /** Precio unitario, si se conoce. */
  price?: number;
}

/** Texto del pedido que se envía por WhatsApp o correo. */
export function orderMessage(greeting: string, lines: OrderLine[], formatMoney?: (amount: number) => string) {
  const items = lines
    .filter((line) => line.quantity > 0)
    .map((line) => `• ${line.quantity} × ${line.name}${line.format ? ` (${line.format})` : ""}${line.sku ? ` [${line.sku}]` : ""}${line.price && formatMoney ? ` — ${formatMoney(line.price * line.quantity)}` : ""}`);
  return items.length ? `${greeting}\n${items.join("\n")}` : greeting;
}

/** Total del pedido; `undefined` si alguna línea no tiene precio. */
export function orderTotal(lines: OrderLine[]) {
  const active = lines.filter((line) => line.quantity > 0);
  if (!active.length || active.some((line) => !line.price)) return undefined;
  return active.reduce((sum, line) => sum + (line.price ?? 0) * line.quantity, 0);
}

/** Enlace para enviar el pedido: WhatsApp si hay número, si no, correo. */
export function orderHref(message: string, contact: { whatsappNumber?: string; email: string }) {
  const number = contact.whatsappNumber?.replace(/\D/g, "");
  return number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `mailto:${contact.email}?subject=${encodeURIComponent("Pedido")}&body=${encodeURIComponent(message)}`;
}
