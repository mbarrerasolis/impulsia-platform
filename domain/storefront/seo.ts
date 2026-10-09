/** Textos para buscadores de la ficha de un producto (título y meta descripción). */

const maxDescription = 158;

function firstSentence(text: string) {
  const end = text.search(/[.!?](\s|$)/);
  return (end > 0 ? text.slice(0, end + 1) : text).trim();
}

function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[\s,;:.-]+$/, "")}…`;
}

export interface ProductSeoInput {
  name: string;
  description?: string;
  categoryName?: string;
  /** Precio público más bajo ya formateado ("$6.540") y su presentación ("500 g"). */
  priceFrom?: { amount: string; format?: string };
  soldOut?: boolean;
  /** Frase de cierre de la marca ("Despacho a todo Chile."). */
  closing?: string;
}

/** "Almendra Nonpareil a granel" → título corto; la plantilla del layout agrega la marca. */
export function productTitle(input: Pick<ProductSeoInput, "name">, sellsByWeight: boolean) {
  return sellsByWeight ? `${input.name} por kilo` : input.name;
}

/** Meta descripción de 150–160 caracteres: qué es, desde cuánto y cómo llega. */
export function productMetaDescription(input: ProductSeoInput) {
  const what = input.description ? firstSentence(input.description) : `${input.name}${input.categoryName ? ` (${input.categoryName.toLowerCase()})` : ""}.`;
  const price = input.soldOut ? "Pronto de vuelta." : input.priceFrom ? `Desde ${input.priceFrom.amount}${input.priceFrom.format ? ` (${input.priceFrom.format})` : ""} IVA incluido.` : "Consulta precio.";
  const parts = [what, price, input.closing].filter(Boolean) as string[];
  // Se recorta primero la descripción para conservar precio y despacho.
  const tail = parts.slice(1).join(" ");
  const room = maxDescription - tail.length - 1;
  return room > 40 ? `${clip(what, room)} ${tail}`.trim() : clip(parts.join(" "), maxDescription);
}
