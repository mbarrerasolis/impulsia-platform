import type { Lead } from "@/domain/crm/entities";
import type { LeadTemperatureView } from "@/domain/crm/lead-temperature";
import type { LeadFilters } from "@/domain/crm/lead-filters";
import type { PageRequest, PageResult } from "@/lib/pagination";

export type LeadListItem = Pick<Lead, "id" | "source" | "name" | "company" | "email" | "phone" | "primaryGoal" | "status" | "score" | "attribution" | "createdAt">;

export type LeadListSort = "priority" | "recent";

export interface LeadListRequest extends Omit<PageRequest, "search">, LeadFilters {
  temperature?: LeadTemperatureView;
  /** priority: más calientes primero; recent: más nuevos primero. */
  sort?: LeadListSort;
}

export interface LeadRepository {
  create(input: Omit<Lead, "id" | "createdAt">): Promise<Lead>;
  list(): Promise<Lead[]>;
  listPage(input?: LeadListRequest): Promise<PageResult<LeadListItem>>;
  /** Cantidad de leads por temperatura, para ver el panorama del pipeline. */
  countByTemperature(filters?: LeadFilters): Promise<Record<LeadTemperatureView, number>>;
  find(id: string): Promise<Lead | undefined>;
  /** Ajusta el score (y con él la temperatura) de un lead. */
  updateScore(id: string, score: number): Promise<void>;
  /** Cuenta los leads web creados desde `since`; con `email`, sólo los de ese correo. */
  countWebLeadsSince(since: string, email?: string): Promise<number>;
  /** Pedidos de la tienda (carro o chat) creados desde `since`. */
  countStoreOrdersSince(since: string): Promise<number>;
}
