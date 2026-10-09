import type { ReviewStatus, ReviewSubmission, StoreReview } from "@/domain/storefront/reviews";
import type { ReviewRepository } from "../review-repository";

/**
 * Modo demo: reseñas en memoria del proceso (se pierden al reiniciar). En globalThis para que rutas
 * de API y páginas, que Next empaqueta por separado, compartan la misma lista.
 */
const globalForDemo = globalThis as unknown as { impulsiaDemoReviews?: StoreReview[] };
const reviews = globalForDemo.impulsiaDemoReviews ??= [];

const newestFirst = (a: StoreReview, b: StoreReview) => b.createdAt.localeCompare(a.createdAt);

export class MemoryReviewRepository implements ReviewRepository {
  async create(input: ReviewSubmission) {
    const review: StoreReview = { id: crypto.randomUUID(), ...input, status: "pending", source: "web", createdAt: new Date().toISOString() };
    reviews.push(review);
    return review;
  }

  async listApproved(limit: number) {
    return reviews.filter((review) => review.status === "approved").sort(newestFirst).slice(0, limit);
  }

  async approvedRatings() {
    return reviews.filter((review) => review.status === "approved").map((review) => review.rating);
  }

  async list(status?: ReviewStatus, limit = 200) {
    return reviews.filter((review) => !status || review.status === status).sort(newestFirst).slice(0, limit);
  }

  async countPendingSince(since: string) {
    return reviews.filter((review) => review.status === "pending" && review.createdAt >= since).length;
  }

  async moderate(id: string, status: Exclude<ReviewStatus, "pending">) {
    const review = reviews.find((item) => item.id === id);
    if (!review) throw new Error("Reseña no encontrada.");
    review.status = status;
    review.moderatedAt = new Date().toISOString();
    return review;
  }
}
