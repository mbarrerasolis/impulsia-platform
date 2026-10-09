import type { Route } from "next";
import Link from "next/link";
import { AlertTriangle, Boxes, PackageX, Tag } from "lucide-react";
import { InventoryRow, InventorySheet, type InventoryRowData } from "@/components/inventory-editor";
import { catalogVariants, inventoryEditorRoles, movementReasonLabels, stockStatus } from "@/domain/storefront/inventory";
import { internalRoles, requireRole } from "@/lib/auth/authorization";
import { getEditionConfig } from "@/lib/edition";
import { formatDate, formatMoney } from "@/lib/format";
import { getStorefront } from "@/lib/storefront";
import { getInventoryRepository } from "@/repositories";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

const filters = {
  todos: "Todos",
  "sin-precio": "Sin precio",
  bajo: "Stock bajo",
  "sin-stock": "Sin stock",
  "no-se-venden": "No se venden",
} as const;
type Filter = keyof typeof filters;

const plain = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Boxes }) {
  return <article className="card stat"><div className="stat-top"><span>{label}</span><Icon size={17} aria-hidden /></div><div className="stat-value">{value}</div><div className="stat-change">{detail}</div></article>;
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireRole(internalRoles);
  const canEdit = (inventoryEditorRoles as readonly string[]).includes(user.role);
  const storefront = getStorefront()!;
  const edition = getEditionConfig();
  const money = (amount: number) => formatMoney(amount, edition.pricing.currency, edition.locale);
  const repository = getInventoryRepository();
  const [records, movements] = await Promise.all([repository.list(), repository.recentMovements(15)]);
  const byKey = new Map(records.map((record) => [record.variantKey, record]));
  const categories = new Map(storefront.categories.map((category) => [category.key, category]));

  const rows: InventoryRowData[] = catalogVariants(storefront).map((variant) => {
    const record = byKey.get(variant.variantKey);
    const price = record?.price ?? variant.price;
    const listPrice = price ? undefined : variant.listPrice;
    return {
      variantKey: variant.variantKey,
      productName: variant.productName,
      formatLabel: variant.formatLabel,
      categoryName: categories.get(variant.category)?.name,
      categoryColor: categories.get(variant.category)?.color,
      sku: record?.sku ?? variant.sku,
      productCode: storefront.products.find((product) => product.key === variant.productKey)?.sku,
      price,
      priceLabel: price ? money(price) : listPrice ? money(listPrice) : "",
      fromList: Boolean(listPrice),
      active: record?.active ?? true,
      trackStock: record?.trackStock ?? false,
      stock: record?.stock ?? 0,
      lowStockThreshold: record?.lowStockThreshold ?? 5,
      status: stockStatus(record),
    };
  });

  const requested = first(params.estado);
  const filter: Filter = requested && requested in filters ? requested as Filter : "todos";
  const query = (first(params.q) ?? "").trim();
  const visible = rows.filter((row) => {
    if (query && !plain(`${row.productName} ${row.formatLabel} ${row.sku ?? ""}`).includes(plain(query))) return false;
    if (filter === "sin-precio") return row.active && !row.price && !row.fromList;
    if (filter === "bajo") return row.active && row.status === "low";
    if (filter === "sin-stock") return row.active && row.status === "out";
    if (filter === "no-se-venden") return !row.active;
    return true;
  });
  const selling = rows.filter((row) => row.active);
  const priced = selling.filter((row) => row.price || row.fromList).length;
  const tracked = selling.filter((row) => row.trackStock).length;
  const low = selling.filter((row) => row.status === "low").length;
  const out = selling.filter((row) => row.status === "out").length;
  const href = (next: Filter) => `/admin/inventory?estado=${next}${query ? `&q=${encodeURIComponent(query)}` : ""}` as Route;

  return <>
    <div className="admin-title">
      <div>
        <h1>Inventario</h1>
        <p className="muted">Precio, SKU y stock de cada presentación del catálogo. Lo que cambies aquí se ve en la tienda al tiro.</p>
      </div>
      <InventorySheet canEdit={canEdit} />
    </div>

    <section className="stat-grid" aria-label="Resumen del inventario">
      <Stat label="Presentaciones a la venta" icon={Boxes} value={String(selling.length)} detail={`${rows.length - selling.length} desactivadas`} />
      <Stat label="Con precio" icon={Tag} value={`${priced} de ${selling.length}`} detail={priced < selling.length ? "Las demás salen \"a consultar\"" : "Todo el catálogo tiene precio"} />
      <Stat label="Stock bajo" icon={AlertTriangle} value={String(low)} detail={`${tracked} con control de stock`} />
      <Stat label="Sin stock" icon={PackageX} value={String(out)} detail="No se pueden agregar al carro" />
    </section>

    <form className="card panel filter-bar" method="get" action="/admin/inventory" aria-label="Buscar en el inventario" style={{ marginTop: 16 }}>
      <nav className="segmented" aria-label="Filtrar por estado">
        {(Object.keys(filters) as Filter[]).map((key) => <Link key={key} href={href(key)} className={filter === key ? "selected" : ""}>{filters[key]}</Link>)}
      </nav>
      <input type="hidden" name="estado" value={filter} />
      <label className="filter-search"><span>Buscar</span><input name="q" defaultValue={query} placeholder="Producto, presentación o SKU" /></label>
      <div className="filter-actions"><button className="btn btn-primary btn-sm" type="submit">Buscar</button></div>
    </form>

    <section className="card panel">
      {visible.length === 0
        ? <p className="muted">No hay presentaciones que coincidan.</p>
        : <div className="table-wrap">
          <table className="data-table compact inv-table">
            <thead><tr><th>Producto</th><th>Presentación</th><th>SKU</th><th className="num">Precio</th><th className="num">Stock</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>{visible.map((row) => <InventoryRow key={row.variantKey} row={row} canEdit={canEdit} />)}</tbody>
          </table>
        </div>}
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Para agregar productos, fotos o presentaciones nuevas se edita el catálogo de la edición; aquí se manejan precio, SKU y stock.</p>
    </section>

    <section className="card panel" style={{ marginTop: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Últimos movimientos</h2>
      {movements.length === 0
        ? <p className="muted">Aún no hay movimientos. Registra un ingreso o un conteo desde &quot;Editar&quot;, o carga la planilla con el stock contado.</p>
        : <div className="table-wrap">
          <table className="data-table compact">
            <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="num">Cantidad</th><th className="num">Saldo</th><th>Nota</th></tr></thead>
            <tbody>{movements.map((movement) => <tr key={movement.id}>
              <td>{formatDate(movement.createdAt)}</td>
              <td>{movement.productName}{movement.formatLabel && <span className="muted"> · {movement.formatLabel}</span>}</td>
              <td>{movementReasonLabels[movement.reason]}</td>
              <td className="num">{movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}</td>
              <td className="num">{movement.stockAfter}</td>
              <td>{movement.note ?? <span className="muted">—</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>}
    </section>
  </>;
}
