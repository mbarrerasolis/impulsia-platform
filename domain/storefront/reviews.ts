import { z } from "zod";

/**
 * Reseñas de clientes de la tienda. Toda reseña entra `pending` y sólo se publica cuando alguien
 * del equipo la aprueba en el panel: el sitio nunca muestra reseñas sin revisar ni inventadas.
 */
export const reviewStatuses = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export const reviewStatusLabels: Record<ReviewStatus, string> = {
  pending: "Por revisar",
  approved: "Publicada",
  rejected: "Rechazada",
};

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export const reviewSubmissionSchema = z.object({
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas.").max(5),
  body: z.string().transform(clean).pipe(z.string().min(10, "Cuéntanos un poco más (mínimo 10 caracteres).").max(600, "Máximo 600 caracteres.")),
  authorName: z.string().transform(clean).pipe(z.string().min(2, "Escribe tu nombre.").max(60)),
  /** Producto que compró (texto libre o nombre del catálogo). */
  productLabel: z.string().transform(clean).pipe(z.string().max(120)).optional().transform((value) => value || undefined),
  /** Correo o teléfono para verificar la compra; nunca se publica. */
  contact: z.string().transform(clean).pipe(z.string().max(120)).optional().transform((value) => value || undefined),
});
export type ReviewSubmission = z.output<typeof reviewSubmissionSchema>;

export interface StoreReview {
  id: string;
  rating: number;
  body: string;
  authorName: string;
  productLabel?: string;
  contact?: string;
  status: ReviewStatus;
  source: "web" | "imported";
  createdAt: string;
  moderatedAt?: string;
}

/** Lo que se muestra en el sitio: sin contacto ni estado. */
export type PublicReview = Pick<StoreReview, "id" | "rating" | "body" | "authorName" | "productLabel" | "createdAt">;

export function toPublicReview(review: StoreReview): PublicReview {
  return { id: review.id, rating: review.rating, body: review.body, authorName: publicName(review.authorName), productLabel: review.productLabel, createdAt: review.createdAt };
}

/** Nombre y la inicial del apellido ("María José P."), para no exponer nombres completos. */
export function publicName(name: string) {
  const parts = clean(name).split(" ");
  if (parts.length < 2) return parts[0] ?? "";
  const last = parts.at(-1)!;
  return `${parts.slice(0, -1).join(" ")} ${last[0]!.toUpperCase()}.`;
}

/** Promedio con un decimal y cantidad; `undefined` sin reseñas. */
export function summarizeRatings(ratings: number[]) {
  if (!ratings.length) return undefined;
  const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  return { average: Math.round(average * 10) / 10, count: ratings.length };
}

/** Más de esto por hora en espera de revisión indica un ataque: se dejan de aceptar por un rato. */
export const maxPendingPerHour = 30;
