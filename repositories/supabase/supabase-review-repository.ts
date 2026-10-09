import { reviewStatuses, type ReviewStatus, type ReviewSubmission, type StoreReview } from "@/domain/storefront/reviews";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { ReviewRepository } from "../review-repository";

function mapReview(row: Tables<"product_reviews">): StoreReview {
  return {
    id: row.id,
    rating: row.rating,
    body: row.body,
    authorName: row.author_name,
    productLabel: row.product_label ?? undefined,
    contact: row.contact ?? undefined,
    status: (reviewStatuses as readonly string[]).includes(row.status) ? row.status as ReviewStatus : "pending",
    source: row.source === "imported" ? "imported" : "web",
    createdAt: row.created_at,
    moderatedAt: row.moderated_at ?? undefined,
  };
}

/**
 * El sitio público es anónimo: crear y leer las publicadas lo hace el servidor con la clave elevada
 * (sin exponer el contacto). El panel lee y modera con la sesión del equipo, bajo RLS.
 */
export class SupabaseReviewRepository implements ReviewRepository {
  async create(input: ReviewSubmission) {
    const { data, error } = await createSupabaseAdminClient().from("product_reviews").insert({
      rating: input.rating,
      body: input.body,
      author_name: input.authorName,
      product_label: input.productLabel ?? null,
      contact: input.contact ?? null,
    }).select("*").single();
    if (error) throw new Error(`No fue posible guardar la reseña: ${error.message}`);
    return mapReview(data);
  }

  async listApproved(limit: number) {
    const { data, error } = await createSupabaseAdminClient().from("product_reviews")
      .select("id, rating, body, author_name, product_label, created_at, status, source, moderated_at, contact, moderated_by")
      .eq("status", "approved").order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(`No fue posible leer las reseñas: ${error.message}`);
    return (data ?? []).map((row) => ({ ...mapReview(row), contact: undefined }));
  }

  async approvedRatings() {
    const { data, error } = await createSupabaseAdminClient().from("product_reviews").select("rating").eq("status", "approved").limit(5000);
    if (error) throw new Error(`No fue posible leer las calificaciones: ${error.message}`);
    return (data ?? []).map((row) => row.rating);
  }

  async list(status?: ReviewStatus, limit = 200) {
    const client = await createSupabaseServerClient();
    let query = client.from("product_reviews").select("*").order("created_at", { ascending: false }).limit(limit);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new Error(`No fue posible leer las reseñas: ${error.message}`);
    return (data ?? []).map(mapReview);
  }

  async countPendingSince(since: string) {
    const { count, error } = await createSupabaseAdminClient().from("product_reviews")
      .select("id", { count: "exact", head: true }).eq("status", "pending").gte("created_at", since);
    if (error) throw new Error(`No fue posible contar reseñas: ${error.message}`);
    return count ?? 0;
  }

  async moderate(id: string, status: Exclude<ReviewStatus, "pending">, moderatedBy?: string) {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.from("product_reviews")
      .update({ status, moderated_at: new Date().toISOString(), moderated_by: moderatedBy ?? null })
      .eq("id", id).select("*").single();
    if (error) throw new Error(`No fue posible moderar la reseña: ${error.message}`);
    return mapReview(data);
  }
}
