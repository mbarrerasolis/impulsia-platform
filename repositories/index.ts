import { getServerEnv } from "@/lib/env";
import type { LeadRepository } from "./lead-repository";
import { MemoryLeadRepository } from "./memory/memory-lead-repository";
import { SupabaseLeadRepository } from "./supabase/supabase-lead-repository";
import { MemoryOperationsRepository } from "./memory/memory-operations-repository";
import { MemoryReadModelRepository } from "./memory/memory-read-model-repository";
import { SupabaseReadModelRepository } from "./supabase/supabase-read-model-repository";
import { MemoryMarketingRepository } from "./memory/memory-marketing-repository";
import { SupabaseMarketingRepository } from "./supabase/supabase-marketing-repository";
import type { ReviewRepository } from "./review-repository";
import { MemoryReviewRepository } from "./memory/memory-review-repository";
import { SupabaseReviewRepository } from "./supabase/supabase-review-repository";
import type { InventoryRepository } from "./inventory-repository";
import { MemoryInventoryRepository } from "./memory/memory-inventory-repository";
import { SupabaseInventoryRepository } from "./supabase/supabase-inventory-repository";
import type { SaleRepository } from "./sale-repository";
import { MemorySaleRepository } from "./memory/memory-sale-repository";
import { SupabaseSaleRepository } from "./supabase/supabase-sale-repository";

export function getLeadRepository(): LeadRepository {
  return getServerEnv().APP_MODE === "supabase"
    ? new SupabaseLeadRepository()
    : new MemoryLeadRepository();
}

export function getOperationsRepository() {
  if (getServerEnv().APP_MODE !== "demo") {
    throw new Error("El repositorio transaccional Supabase se habilitará tras validar las migraciones en un proyecto conectado.");
  }
  return new MemoryOperationsRepository();
}

export function getReadModelRepository(){return getServerEnv().APP_MODE==="supabase"?new SupabaseReadModelRepository():new MemoryReadModelRepository();}

export function getMarketingRepository() {
  return getServerEnv().APP_MODE === "supabase" ? new SupabaseMarketingRepository() : new MemoryMarketingRepository();
}

export function getReviewRepository(): ReviewRepository {
  return getServerEnv().APP_MODE === "supabase" ? new SupabaseReviewRepository() : new MemoryReviewRepository();
}

export function getInventoryRepository(): InventoryRepository {
  return getServerEnv().APP_MODE === "supabase" ? new SupabaseInventoryRepository() : new MemoryInventoryRepository();
}

export function getSaleRepository(): SaleRepository {
  return getServerEnv().APP_MODE === "supabase" ? new SupabaseSaleRepository() : new MemorySaleRepository();
}
