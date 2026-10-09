import type { Route } from "next";
import Link from "next/link";

type AdminListPath =
  | "/admin/accounts"
  | "/admin/billing"
  | "/admin/conversations"
  | "/admin/crm"
  | "/admin/solutions";

function pageHref(path: AdminListPath, page: number, search?: string, extra?: Record<string, string>) {
  const params = new URLSearchParams(extra);
  if (page > 1) params.set("page", String(page));
  if (search) params.set("q", search);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}` as Route;
}

export function Pagination({
  path,
  page,
  totalPages,
  total,
  search,
  params,
}: {
  path: AdminListPath;
  page: number;
  totalPages: number;
  total: number;
  search?: string;
  /** Filtros de la lista que se conservan al cambiar de página. */
  params?: Record<string, string>;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Paginación">
      <Link
        className={`btn btn-secondary ${page <= 1 ? "disabled" : ""}`}
        href={pageHref(path, Math.max(1, page - 1), search, params)}
        aria-disabled={page <= 1}
      >
        Anterior
      </Link>
      <span className="muted">Página {page} de {totalPages} · {total} registros</span>
      <Link
        className={`btn btn-secondary ${page >= totalPages ? "disabled" : ""}`}
        href={pageHref(path, Math.min(totalPages, page + 1), search, params)}
        aria-disabled={page >= totalPages}
      >
        Siguiente
      </Link>
    </nav>
  );
}
