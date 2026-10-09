import { mixQuote, type StoreMix } from "@/domain/config/storefront";
import { grossPrice, type PriceRules } from "./pricing";

/**
 * Mix a medida (`mix.minIngredientGrams`): el cliente elige ingredientes y gramos de cada uno, con un
 * mínimo por ingrediente y un total mínimo (`mix.grams`). Sin `minIngredientGrams` el mix se reparte en
 * partes iguales (comportamiento original).
 */
export interface MixSelection { key: string; grams: number }

type MixConfig = Pick<StoreMix, "grams" | "ingredients" | "maxItems" | "wholesale" | "minIngredientGrams" | "stepGrams">;

export const isCustomMix = (mix: Pick<StoreMix, "minIngredientGrams">) => Boolean(mix.minIngredientGrams);

/** Gramos que se proponen a cada ingrediente al elegirlo: reparte el mínimo total sin bajar del mínimo por ingrediente. */
export function suggestedGrams(mix: Pick<MixConfig, "grams" | "minIngredientGrams" | "stepGrams">, count: number) {
  const step = mix.stepGrams;
  const share = Math.ceil(mix.grams / Math.max(1, count) / step) * step;
  return Math.max(mix.minIngredientGrams ?? 0, share);
}

/** Reparte de nuevo cuando cambia la cantidad de ingredientes (cada uno vuelve a la sugerencia). */
export function rebalance(mix: Pick<MixConfig, "grams" | "minIngredientGrams" | "stepGrams">, keys: string[]): MixSelection[] {
  const grams = suggestedGrams(mix, keys.length);
  return keys.map((key) => ({ key, grams }));
}

export function quoteCustomMix(mix: MixConfig, selection: MixSelection[], rules: PriceRules) {
  const problems: string[] = [];
  const parts = selection.flatMap((item) => {
    const ingredient = mix.ingredients.find((candidate) => candidate.key === item.key);
    return ingredient ? [{ ...ingredient, grams: item.grams }] : [];
  });
  const totalGrams = parts.reduce((sum, part) => sum + part.grams, 0);
  const minimum = mix.minIngredientGrams ?? 0;
  if (parts.length > mix.maxItems) problems.push(`Máximo ${mix.maxItems} ingredientes.`);
  for (const part of parts) {
    if (part.grams < minimum) problems.push(`${part.name}: mínimo ${minimum} g.`);
    if (part.grams % mix.stepGrams !== 0) problems.push(`${part.name}: en pasos de ${mix.stepGrams} g.`);
  }
  if (parts.length && totalGrams < mix.grams) problems.push(`Te faltan ${mix.grams - totalGrams} g para el mínimo de ${formatWeight(mix.grams)}.`);
  const priced = parts.length > 0 && parts.every((part) => part.pricePerKg);
  const listed = priced ? parts.reduce((sum, part) => sum + part.pricePerKg! * part.grams / 1000, 0) : undefined;
  const price = listed === undefined ? undefined : mix.wholesale ? grossPrice(listed, 1, rules) : Math.round(listed / rules.roundTo) * rules.roundTo;
  return { parts, totalGrams, net: mix.wholesale && listed !== undefined ? Math.round(listed) : undefined, price, problems, valid: parts.length > 0 && problems.length === 0 };
}

export function formatWeight(grams: number) {
  return grams >= 1000 ? `${(grams / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} kg` : `${grams} g`;
}

/** Línea del carro: "mix::nuez:1200+mani-natural:600" (a medida) o "mix::nuez+mani" (partes iguales). */
export function mixLineId(selection: MixSelection[], custom: boolean) {
  const sorted = [...selection].sort((a, b) => a.key.localeCompare(b.key));
  return `mix::${sorted.map((item) => custom ? `${item.key}:${item.grams}` : item.key).join("+")}`;
}

/** Cotiza una línea de mix del carro tal como llegó del navegador (el servidor recalcula el precio). */
export function quoteMixLine(mix: MixConfig, id: string, rules: PriceRules) {
  const tokens = id.replace(/^mix::/, "").split("+").filter(Boolean);
  if (isCustomMix(mix)) {
    const selection = tokens.map((token) => { const [key, grams] = token.split(":"); return { key, grams: Number(grams) }; }).filter((item) => Number.isInteger(item.grams) && item.grams > 0);
    const quote = quoteCustomMix(mix, selection, rules);
    return { parts: quote.parts, price: quote.valid ? quote.price : undefined, net: quote.valid ? quote.net : undefined, problems: quote.problems };
  }
  const quote = mixQuote(mix, tokens, rules);
  return { parts: quote.parts, price: quote.price, net: quote.net, problems: [] as string[] };
}

/** Agrega un ingrediente sin tocar los gramos ya elegidos: el nuevo recibe lo que falta para el mínimo total. */
export function addIngredient(mix: Pick<MixConfig, "grams" | "minIngredientGrams" | "stepGrams" | "maxItems">, selection: MixSelection[], key: string): MixSelection[] {
  if (selection.some((item) => item.key === key) || selection.length >= mix.maxItems) return selection;
  if (!selection.length) return rebalance(mix, [key]);
  const total = selection.reduce((sum, item) => sum + item.grams, 0);
  const missing = Math.ceil(Math.max(0, mix.grams - total) / mix.stepGrams) * mix.stepGrams;
  return [...selection, { key, grams: Math.max(mix.minIngredientGrams ?? mix.stepGrams, missing) }];
}

/** Quita un ingrediente; los demás conservan sus gramos (si falta peso, el armador lo avisa). */
export function removeIngredient(selection: MixSelection[], key: string) {
  return selection.filter((item) => item.key !== key);
}
