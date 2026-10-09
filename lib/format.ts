import activeEdition from "@/config/edition.json";

export function formatMoney(
  amount: number,
  currency = process.env.NEXT_PUBLIC_COMMERCE_CURRENCY || activeEdition.commerce.currency,
  locale = process.env.NEXT_PUBLIC_COMMERCE_LOCALE || activeEdition.commerce.locale,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** @deprecated Usa formatMoney; se conserva para compatibilidad interna. */
export const formatClp = formatMoney;

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat(process.env.NEXT_PUBLIC_COMMERCE_LOCALE || activeEdition.commerce.locale, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(typeof date === "string" ? new Date(date) : date);
}
