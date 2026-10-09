import type { SaleStatus } from "@/domain/storefront/sales";

/** Fecha y hora de Chile para cotizaciones, pagos e historial. */
export function formatSaleDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }).format(new Date(iso));
}

export const saleStatusClass: Record<SaleStatus, string> = {
  quote_draft: "",
  quote_sent: "prospect",
  quote_revised: "prospect",
  quote_accepted: "prospect",
  payment_pending: "paused",
  payment_in_review: "paused",
  paid: "active",
  preparing: "active",
  ready_to_ship: "active",
  shipped: "active",
  delivered: "active",
  cancelled: "danger",
};
