import type { ReviewStatus, ReviewSubmission, StoreReview } from "@/domain/storefront/reviews";

export interface ReviewRepository {
  /** Guarda una reseña del sitio, siempre `pending`. */
  create(input: ReviewSubmission): Promise<StoreReview>;
  /** Reseñas publicadas, más recientes primero. */
  listApproved(limit: number): Promise<StoreReview[]>;
  /** Calificaciones de todas las publicadas (para el promedio). */
  approvedRatings(): Promise<number[]>;
  /** Para el panel: por estado, más recientes primero. */
  list(status?: ReviewStatus, limit?: number): Promise<StoreReview[]>;
  countPendingSince(since: string): Promise<number>;
  moderate(id: string, status: Exclude<ReviewStatus, "pending">, moderatedBy?: string): Promise<StoreReview>;
}
