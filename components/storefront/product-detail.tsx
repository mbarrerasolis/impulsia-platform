"use client";

import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { tierPrices, type StoreProduct } from "@/domain/config/storefront";
import { bulkLabel, useProductPurchase } from "./product-card";
import { useStore } from "./store-provider";

/** Compra en la ficha: presentación, cantidad, precio y precios por tramo. */
export function ProductBuy({ product, wholesaleMinimum }: { product: StoreProduct; wholesaleMinimum?: number }) {
  const { format, formatIndex, setFormatIndex, price, stock, soldOut, justAdded, addToCart, money, rules } = useProductPurchase(product);
  const { setCartOpen } = useStore();
  const [quantity, setQuantity] = useState(1);
  const tiers = tierPrices(product, rules);
  const per = product.unit ? "c/u" : "el kg";

  return <div className="st-pd-buy">
    {product.formats.length > 1 && <div className="st-pd-field">
      <span className="st-pd-label" id="st-pd-format">Presentación</span>
      <div className="st-formats st-formats-lg" role="group" aria-labelledby="st-pd-format">
        {product.formats.map((item, index) => <button key={item.label} type="button" aria-pressed={index === formatIndex} data-out={item.stock === "out" || undefined} onClick={() => setFormatIndex(index)}>{item.label}</button>)}
      </div>
    </div>}

    <p className="st-pd-price" data-none={!price || undefined}>
      {price ? money(price) : soldOut ? "Sin stock" : "Precio a consultar"}
      {price && <small>{format?.label ?? product.unit ?? ""} · IVA incluido</small>}
    </p>
    {stock === "low" && <p className="st-low">Últimas unidades</p>}

    {soldOut
      ? <p className="st-pd-out">Sin stock por ahora. Escríbenos y te avisamos cuando vuelva.</p>
      : <div className="st-pd-actions">
        <div className="st-qty st-qty-lg" role="group" aria-label="Cantidad">
          <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Una menos"><Minus size={16} /></button>
          <output aria-live="polite">{quantity}</output>
          <button type="button" onClick={() => setQuantity(Math.min(99, quantity + 1))} aria-label="Una más"><Plus size={16} /></button>
        </div>
        <button type="button" className="st-btn st-btn-hot" onClick={() => addToCart(quantity)} data-done={justAdded || undefined}>
          {justAdded ? <><Check size={18} aria-hidden="true" /> Agregado</> : <><ShoppingBag size={18} aria-hidden="true" /> Agregar al carro</>}
        </button>
        {justAdded && <button type="button" className="st-link" onClick={() => setCartOpen(true)}>Ver carro</button>}
      </div>}

    {tiers && <table className="st-pd-tiers">
      <caption>Precio {product.unit ? "por unidad" : "por kilo"}, IVA incluido</caption>
      <tbody>
        <tr><th scope="row">Hasta {bulkLabel(product, rules.bulkFrom - (product.unit ? 1 : 0.1))}</th><td>{money(tiers.base)} {per}</td></tr>
        {tiers.bulk && <tr><th scope="row">Desde {bulkLabel(product, rules.bulkFrom)}</th><td><b>{money(tiers.bulk)} {per}</b></td></tr>}
      </tbody>
    </table>}
    {tiers?.bulk && <p className="st-pd-note">El precio por volumen se aplica solo en el carro al sumar {bulkLabel(product, rules.bulkFrom)} de este producto, en cualquier presentación.</p>}
    {wholesaleMinimum && product.net && <p className="st-pd-note">¿Tienes un negocio? Compra desde {bulkLabel(product, wholesaleMinimum)} con factura: {money(product.net.base)} + IVA {per}{product.net.bulk && product.net.bulk < product.net.base ? ` (${money(product.net.bulk)} + IVA desde ${bulkLabel(product, rules.bulkFrom)})` : ""}.</p>}
  </div>;
}
