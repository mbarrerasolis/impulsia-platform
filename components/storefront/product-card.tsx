"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { formatPrice, formatPricing, skuFor, tierPrices, type StoreCategory, type StoreProduct } from "@/domain/config/storefront";
import { useStore } from "./store-provider";
import { Visual } from "./visual";

/** "1 kg", "6 unidades": cuánto hay que llevar para el precio por volumen. */
export function bulkLabel(product: Pick<StoreProduct, "unit">, amount: number) {
  if (product.unit) return amount === 1 ? "1 unidad" : `${amount} unidades`;
  return `${amount.toLocaleString("es-CL", { maximumFractionDigits: 1 })} kg`;
}

/** Elige presentación y agrega al carro; la usan la tarjeta y la ficha del producto. */
export function useProductPurchase(product: StoreProduct) {
  const { add, money, rules } = useStore();
  // Parte en la presentación más grande que tenga stock.
  const [formatIndex, setFormatIndex] = useState(() => {
    const index = product.formats.findLastIndex((item) => item.stock !== "out");
    return index >= 0 ? index : Math.max(0, product.formats.length - 1);
  });
  const [justAdded, setJustAdded] = useState(false);
  const format = product.formats[formatIndex];
  const price = formatPrice(product, format, rules);
  const stock = format ? format.stock : product.stock;
  const soldOut = stock === "out";

  const addToCart = (quantity = 1) => {
    if (soldOut) return;
    const sku = skuFor(product, format?.label);
    add({ id: `${product.key}::${format?.label ?? ""}`, sku, name: product.name, format: format?.label ?? product.unit, price, pricing: formatPricing(product, format) }, quantity);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  };
  return { format, formatIndex, setFormatIndex, price, stock, soldOut, justAdded, addToCart, money, rules };
}

/** Tarjeta de producto: foto, categoría, formato y botón de agregar al carro. */
export function ProductCard({ product, category }: { product: StoreProduct; category?: StoreCategory }) {
  const { format, formatIndex, setFormatIndex, price, stock, soldOut, justAdded, addToCart, money, rules } = useProductPurchase(product);
  const tiers = tierPrices(product, rules);
  const href = `/productos/${product.key}` as const;
  const style = category?.color ? { "--cat": category.color, "--cat-ink": category.darkText ? "#1A100A" : "#FFFFFF" } as CSSProperties : undefined;

  return <article className="st-card" style={style}>
    <Link href={href} className="st-card-media" tabIndex={-1} aria-hidden="true">
      <Visual image={product.image} texture={product.texture} className="st-card-photo">
        {category && <span className="st-badge">{category.name}</span>}
        {product.tags[0] && <span className="st-chip">{product.tags[0]}</span>}
      </Visual>
    </Link>
    <div className="st-card-body">
      <h4><Link href={href}>{product.name}</Link></h4>
      {product.formats.length > 1 && <div className="st-formats" role="group" aria-label={`Presentación de ${product.name}`}>
        {product.formats.map((item, index) => <button key={item.label} type="button" aria-pressed={index === formatIndex} data-out={item.stock === "out" || undefined} onClick={() => setFormatIndex(index)}>{item.label}</button>)}
      </div>}
      <div className="st-buy">
        <span className="st-price" data-none={!price || undefined}>
          {price ? money(price) : soldOut ? "Sin stock" : "Precio a consultar"}
          {(format || product.unit || stock === "low") && <small>{format?.label ?? product.unit}{(format || product.unit) && stock === "low" ? " · " : ""}{stock === "low" && <b className="st-low">Últimas unidades</b>}</small>}
        </span>
        {soldOut
          ? <span className="st-add st-soldout" role="status">Sin stock</span>
          : <button type="button" className="st-add" data-done={justAdded || undefined} onClick={() => addToCart()} aria-label={`Agregar ${product.name}${format ? ` ${format.label}` : ""} al carro`}>
            {justAdded ? <><Check size={16} aria-hidden="true" /> Listo</> : <><Plus size={16} aria-hidden="true" /> Agregar</>}
          </button>}
      </div>
      {tiers?.bulk && !soldOut && <p className="st-tier">Desde {bulkLabel(product, rules.bulkFrom)}: <b>{money(tiers.bulk)}</b>{product.unit ? " c/u" : " el kg"}</p>}
    </div>
  </article>;
}
