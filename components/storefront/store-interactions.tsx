"use client";

import { Minus, Plus, Search, Send, ShoppingBag, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { mixQuote, type StoreCategory, type StoreMix } from "@/domain/config/storefront";
import { addIngredient, formatWeight, isCustomMix, mixLineId, quoteCustomMix, rebalance, removeIngredient, type MixSelection } from "@/domain/storefront/custom-mix";
import { CheckoutForm } from "./checkout-form";
import { useStore } from "./store-provider";
import { Visual } from "./visual";

/** Baja al catálogo; `false` si la página no lo tiene (una ficha de producto). */
function scrollToCatalog() {
  const catalog = document.getElementById("catalogo");
  catalog?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return Boolean(catalog);
}

/** Buscador grande del hero: filtra el catálogo y baja hasta él. */
export function HeroSearch({ suggestions }: { suggestions: string[] }) {
  const { setQuery, setCategory } = useStore();
  const [value, setValue] = useState("");
  const go = (term: string) => { setCategory("all"); setQuery(term); scrollToCatalog(); };
  const onSubmit = (event: FormEvent) => { event.preventDefault(); go(value.trim()); };
  return <div className="st-hero-search">
    <form className="st-search st-search-hero" role="search" onSubmit={onSubmit}>
      <Search size={20} aria-hidden="true" />
      <label htmlFor="st-hero-search" className="sr-only">Buscar producto</label>
      <input id="st-hero-search" type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="¿Qué buscas? Nuez, arándano, maní…" />
      <button type="submit" className="st-btn st-btn-hot">Buscar</button>
    </form>
    {suggestions.length > 0 && <div className="st-suggest">
      {suggestions.map((term) => <button key={term} type="button" onClick={() => go(term)}>{term}</button>)}
    </div>}
  </div>;
}

/** Lleva al catálogo filtrado por un producto (desde un reel o un enlace). */
export function FindProductButton({ name, className, children }: { name: string; className?: string; children: React.ReactNode }) {
  const { setQuery, setCategory } = useStore();
  return <button type="button" className={className} onClick={() => { setCategory("all"); setQuery(name); scrollToCatalog(); }}>{children}</button>;
}

/** Tarjetas de categoría por color: filtran el catálogo. */
export function CategoryTiles({ categories }: { categories: (StoreCategory & { count: number; sample?: string })[] }) {
  const { setCategory, setQuery } = useStore();
  return <div className="st-cats">
    {categories.map((category) => <button key={category.key} type="button" className="st-cat" data-dark={category.darkText || undefined}
      style={category.color ? { "--cat": category.color } as CSSProperties : undefined}
      onClick={() => { setQuery(""); setCategory(category.key); scrollToCatalog(); }}>
      <span className="st-cat-name">{category.name}</span>
      <span className="st-cat-meta">{category.sample ?? `${category.count} productos`}</span>
      <Visual image={category.image} texture={category.texture} className="st-cat-blob" />
    </button>)}
  </div>;
}

/** Armador de mix: elige ingredientes, ve el reparto y lo agrega al carro como una línea. */
export function MixBuilder({ mix }: { mix: StoreMix }) {
  const { add, money, rules } = useStore();
  const custom = isCustomMix(mix);
  // Partes iguales: sólo importan las claves; a medida, cada ingrediente lleva sus gramos.
  const [selection, setSelection] = useState<MixSelection[]>(() => rebalance(mix, mix.ingredients.slice(0, 3).map((item) => item.key)));
  const [added, setAdded] = useState(false);
  const picked = selection.map((item) => item.key);
  const quote = custom ? quoteCustomMix(mix, selection, rules) : { ...mixQuote(mix, picked, rules), problems: [] as string[], valid: picked.length > 0, totalGrams: mix.grams };
  const wholesale = mix.wholesale;
  const minimum = mix.minIngredientGrams ?? 0;
  const maxGrams = 10_000;

  // A medida: agregar o quitar no toca los gramos ya elegidos; en partes iguales se reparte de nuevo.
  const toggle = (key: string) => setSelection((current) => {
    const selected = current.some((item) => item.key === key);
    if (custom) return selected ? removeIngredient(current, key) : addIngredient(mix, current, key);
    const keys = selected ? current.filter((item) => item.key !== key).map((item) => item.key) : current.length < mix.maxItems ? [...current.map((item) => item.key), key] : current.map((item) => item.key);
    return rebalance(mix, keys);
  });
  const adjust = (key: string, delta: number) => setSelection((current) => current.map((item) => item.key === key ? { ...item, grams: Math.min(maxGrams, Math.max(minimum, item.grams + delta)) } : item));
  const onAdd = () => {
    if (!quote.valid) return;
    const names = quote.parts.map((part) => custom ? `${part.name} ${formatWeight(part.grams)}` : part.name);
    add({ id: mixLineId(selection, custom), name: `Mix${wholesale ? " mayorista" : ""}: ${names.join(", ")}`, format: formatWeight(quote.totalGrams), price: quote.price });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };

  return <div className="st-mix">
    <div className="st-mix-pick">
      <p className="st-mix-hint">{picked.length}/{mix.maxItems} ingredientes{custom ? ` · mínimo ${formatWeight(minimum)} de cada uno y ${formatWeight(mix.grams)} en total` : ""} · toca para agregar o quitar</p>
      <div className="st-mix-items" role="group" aria-label="Ingredientes del mix">
        {mix.ingredients.map((item) => <button key={item.key} type="button" aria-pressed={picked.includes(item.key)} onClick={() => toggle(item.key)}
          disabled={!picked.includes(item.key) && picked.length >= mix.maxItems}>
          <Visual image={item.image} texture={item.texture} className="st-mix-thumb" />
          <span><b>{item.name}</b><small>{item.pricePerKg ? `${money(item.pricePerKg)} / kg${wholesale ? " neto" : ""}` : "Precio a consultar"}</small></span>
        </button>)}
      </div>
    </div>
    <div className="st-mix-out" aria-live="polite">
      <h3>Tu mix de {formatWeight(quote.totalGrams || mix.grams)}</h3>
      <div className="st-mix-jar" aria-hidden="true">{quote.parts.map((part) => <span key={part.key} style={{ background: part.color, flexGrow: part.grams }} />)}</div>
      {quote.parts.length
        ? <ul>{quote.parts.map((part) => <li key={part.key}>
          <span className="st-mix-name">
            <button type="button" className="st-mix-remove" onClick={() => toggle(part.key)} aria-label={`Quitar ${part.name} del mix`} title="Quitar"><X size={14} /></button>
            <i style={{ background: part.color }} />{part.name}
          </span>
          {custom
            ? <span className="st-mix-qty" role="group" aria-label={`Gramos de ${part.name}`}>
              <button type="button" onClick={() => adjust(part.key, -mix.stepGrams)} disabled={part.grams <= minimum} aria-label={`${mix.stepGrams} g menos de ${part.name}`}><Minus size={14} /></button>
              <output>{formatWeight(part.grams)}</output>
              <button type="button" onClick={() => adjust(part.key, mix.stepGrams)} disabled={part.grams >= maxGrams} aria-label={`${mix.stepGrams} g más de ${part.name}`}><Plus size={14} /></button>
            </span>
            : <span>{part.grams} g</span>}
        </li>)}</ul>
        : <p className="st-mix-empty">Elige ingredientes para ver tu mezcla.</p>}
      {quote.problems.length > 0 && <p className="st-mix-warn">{quote.problems.join(" ")}</p>}
      {wholesale && quote.net !== undefined
        ? <>
          <p className="st-mix-total"><span>Neto</span><b>{money(quote.net)} <small>+ IVA</small></b></p>
          <p className="st-mix-gross">Total con IVA: {money(quote.price!)} · precio mayorista tramo 3 a 5 kg</p>
        </>
        : <p className="st-mix-total"><span>Precio</span><b>{quote.price ? money(quote.price) : quote.parts.length ? "Te lo confirmamos" : "—"}</b></p>}
      <button type="button" className="st-btn st-btn-peach" onClick={onAdd} disabled={!quote.valid}>{added ? "Mix agregado" : "Agregar mix al carro"}</button>
    </div>
  </div>;
}

/** Botón del carro en el encabezado. */
export function CartButton() {
  const { units, setCartOpen } = useStore();
  return <button type="button" className="st-cart-btn" onClick={() => setCartOpen(true)} aria-label={`Abrir carro, ${units} ${units === 1 ? "unidad" : "unidades"}`}>
    <ShoppingBag size={18} aria-hidden="true" /> Carro <b>{units}</b>
  </button>;
}

/** Panel lateral del carro y aviso breve al agregar. */
export function CartDrawer({ brandName }: { brandName: string }) {
  const { lines, units, total, setQuantity, clear, cartOpen, setCartOpen, money, checkoutChannel, lastAdded, missingForBulk } = useStore();
  const hinted = new Set<string>();
  /** Un aviso por producto: cuánto le falta para el precio por volumen. */
  const bulkHint = (line: (typeof lines)[number]) => {
    if (!line.pricing || hinted.has(line.pricing.productKey)) return undefined;
    hinted.add(line.pricing.productKey);
    const missing = missingForBulk(line.pricing);
    if (!missing) return line.pricing.bulk && line.pricing.bulk < line.pricing.base ? "Precio por volumen aplicado" : undefined;
    const amount = line.pricing.perUnit ? `${Math.ceil(missing)} más` : `${missing.toLocaleString("es-CL", { maximumFractionDigits: 1 })} kg más`;
    return `Lleva ${amount} y baja el precio por volumen`;
  };
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!cartOpen) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setCartOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [cartOpen, setCartOpen]);

  return <>
    {lastAdded && !cartOpen && <div className="st-toast" role="status">
      <span>Agregaste <b>{lastAdded}</b></span>
      <button type="button" onClick={() => setCartOpen(true)}>Ver carro ({units})</button>
    </div>}
    <div className="st-drawer" data-open={cartOpen || undefined} aria-hidden={!cartOpen}>
      <button type="button" className="st-drawer-scrim" tabIndex={-1} onClick={() => setCartOpen(false)} aria-label="Cerrar carro" />
      <div className="st-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="st-cart-title" tabIndex={-1} ref={panelRef}>
        <header>
          <h2 id="st-cart-title">Tu carro</h2>
          <button type="button" onClick={() => setCartOpen(false)} aria-label="Cerrar carro"><X size={20} /></button>
        </header>
        {lines.length === 0
          ? <div className="st-drawer-empty">
            <ShoppingBag size={36} aria-hidden="true" />
            <p>Tu carro está vacío. Agrega productos desde el catálogo o arma tu mix.</p>
            <button type="button" className="st-btn st-btn-peach" onClick={() => { setCartOpen(false); if (!scrollToCatalog()) router.push("/#catalogo"); }}>Ver productos</button>
          </div>
          : !checkingOut && <ul className="st-lines">
            {lines.map((line) => <li key={line.id}>
              <div className="st-line-info">
                <b>{line.name}</b>
                <small>{[line.format, line.sku && `SKU ${line.sku}`].filter(Boolean).join(" · ")}</small>
                <span className="st-line-price">{line.price ? money(line.price * line.quantity) : "Precio a confirmar"}</span>
                {(() => { const hint = bulkHint(line); return hint && <span className="st-line-tier">{hint}</span>; })()}
              </div>
              <div className="st-qty" role="group" aria-label={`Cantidad de ${line.name}`}>
                <button type="button" onClick={() => setQuantity(line.id, line.quantity - 1)} aria-label={`Quitar uno de ${line.name}`}>{line.quantity === 1 ? <Trash2 size={15} /> : <Minus size={15} />}</button>
                <output>{line.quantity}</output>
                <button type="button" onClick={() => setQuantity(line.id, line.quantity + 1)} aria-label={`Agregar uno de ${line.name}`}><Plus size={15} /></button>
              </div>
            </li>)}
          </ul>}
        {lines.length > 0 && <footer className={checkingOut ? "st-footer-form" : undefined}>
          <p className="st-drawer-total"><span>Total <small>IVA incluido</small></span><b>{total ? money(total) : "Lo confirmamos contigo"}</b></p>
          {checkingOut
            ? <CheckoutForm onCancel={() => setCheckingOut(false)} />
            : <>
              <button type="button" className="st-btn st-btn-hot st-checkout" onClick={() => setCheckingOut(true)}>
                Continuar con el pedido <Send size={18} aria-hidden="true" />
              </button>
              <p className="st-drawer-note">{brandName} te responde por {checkoutChannel} con stock, despacho y forma de pago antes de cobrar.</p>
              <button type="button" className="st-link" onClick={clear}>Vaciar carro</button>
            </>}
        </footer>}
      </div>
    </div>
  </>;
}
