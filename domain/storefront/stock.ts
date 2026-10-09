export const stockStatuses = ["untracked", "in_stock", "low", "out"] as const;
export type StockStatus = (typeof stockStatuses)[number];

export const stockStatusLabels: Record<StockStatus, string> = {
  untracked: "Sin control",
  in_stock: "Disponible",
  low: "Stock bajo",
  out: "Sin stock",
};
