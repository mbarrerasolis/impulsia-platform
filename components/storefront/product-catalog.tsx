"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { StoreCategory, StoreProduct } from "@/domain/config/storefront";
import { ProductCard } from "./product-card";
import { useStore } from "./store-provider";

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Catálogo completo: búsqueda, filtro por categoría y productos agrupados. */
export function ProductCatalog({ groups }: { groups: { category: StoreCategory; products: StoreProduct[] }[] }) {
  const { query, setQuery, category, setCategory } = useStore();
  // Sin búsqueda ni filtro, cada categoría muestra una fila y se despliega con "Ver más" (todo sigue en el HTML).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const browsing = !query.trim() && category === "all";
  const toggleGroup = (key: string) => setExpanded((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const visible = useMemo(() => {
    const term = normalize(query.trim());
    return groups
      .filter((group) => category === "all" || group.category.key === category)
      .map((group) => ({ ...group, products: group.products.filter((product) => !term || normalize(`${product.name} ${product.tags.join(" ")} ${group.category.name}`).includes(term)) }))
      .filter((group) => group.products.length > 0);
  }, [groups, category, query]);
  const count = visible.reduce((sum, group) => sum + group.products.length, 0);

  return <div className="st-catalog">
    <div className="st-filters">
      <label className="st-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Buscar en el catálogo</span>
        <input id="st-catalog-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca nuez, arándano, harina…" />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="Borrar búsqueda"><X size={16} /></button>}
      </label>
      <div className="st-chips" role="group" aria-label="Filtrar por categoría">
        <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>Todo</button>
        {groups.map((group) => <button key={group.category.key} type="button" aria-pressed={category === group.category.key} onClick={() => setCategory(group.category.key)} style={group.category.color ? { "--cat": group.category.color } as React.CSSProperties : undefined}>{group.category.name}</button>)}
      </div>
      <p className="st-count" aria-live="polite">{count === 1 ? "1 producto" : `${count} productos`}{query && ` para “${query}”`}</p>
    </div>

    {visible.length === 0 && <div className="st-empty">
      <p>No encontramos “{query}” en el catálogo.</p>
      <button type="button" className="st-btn st-btn-peach" onClick={() => { setQuery(""); setCategory("all"); }}>Ver todos los productos</button>
    </div>}

    {visible.map((group) => { const collapsed = browsing && !expanded.has(group.category.key); return <section key={group.category.key} id={`cat-${group.category.key}`} className="st-group" data-collapsed={collapsed || undefined} aria-labelledby={`st-cat-${group.category.key}`}>
      <div className="st-group-head">
        <h3 id={`st-cat-${group.category.key}`}><span className="st-dot" style={group.category.color ? { background: group.category.color } : undefined} aria-hidden="true" />{group.category.name}</h3>
        {group.category.description && <p>{group.category.description}</p>}
      </div>
      <div className="st-products st-products-group" data-count={group.products.length}>
        {group.products.map((product) => <ProductCard key={product.key} product={product} category={group.category} />)}
      </div>
      {browsing && group.products.length > 3 && <button type="button" className="st-more" aria-expanded={!collapsed} onClick={() => {
        if (!collapsed) document.getElementById(`cat-${group.category.key}`)?.scrollIntoView({ block: "start" });
        toggleGroup(group.category.key);
      }}>
        {collapsed ? <>Ver los {group.products.length} productos de {group.category.name.toLowerCase()} <ChevronDown size={18} aria-hidden="true" /></> : <>Ver menos <ChevronUp size={18} aria-hidden="true" /></>}
      </button>}
    </section>; })}
  </div>;
}
