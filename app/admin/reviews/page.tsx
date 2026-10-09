import type { Route } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { ReviewModeration } from "@/components/review-moderation";
import { reviewStatuses, reviewStatusLabels, summarizeRatings, type ReviewStatus } from "@/domain/storefront/reviews";
import { formatDate } from "@/lib/format";
import { getReviewRepository } from "@/repositories";

type SearchParams = Record<string, string | string[] | undefined>;

function Stars({ value }: { value: number }) {
  return <span className="review-stars" role="img" aria-label={`${value} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((step) => <Star key={step} size={15} fill={value >= step ? "currentColor" : "none"} aria-hidden="true" />)}
  </span>;
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const requested = Array.isArray(params.estado) ? params.estado[0] : params.estado;
  const status: ReviewStatus = (reviewStatuses as readonly string[]).includes(requested ?? "") ? requested as ReviewStatus : "pending";
  const repository = getReviewRepository();
  const [reviews, pending, ratings] = await Promise.all([repository.list(status), repository.list("pending"), repository.approvedRatings()]);
  const summary = summarizeRatings(ratings);

  return <>
    <div className="admin-title">
      <div>
        <h1>Reseñas</h1>
        <p className="muted">Las reseñas que envían los clientes desde el sitio. Sólo aparecen en la tienda las que publicas aquí.</p>
      </div>
      <span className="state active">{summary ? `${summary.average.toLocaleString("es-CL")} ★ · ${summary.count} publicadas` : "Aún sin reseñas publicadas"}</span>
    </div>

    <nav className="filter-bar" aria-label="Estado de las reseñas">
      {reviewStatuses.map((item) => <Link key={item} href={`/admin/reviews?estado=${item}` as Route} className={`btn btn-sm ${item === status ? "btn-primary" : "btn-secondary"}`} aria-current={item === status ? "page" : undefined}>
        {reviewStatusLabels[item]}{item === "pending" && pending.length > 0 ? ` (${pending.length})` : ""}
      </Link>)}
    </nav>

    <section className="card panel" style={{ marginTop: 16 }}>
      {reviews.length === 0
        ? <p className="muted">{status === "pending" ? "No hay reseñas por revisar. Cuando un cliente califique su compra en el sitio, aparecerá aquí." : `No hay reseñas ${reviewStatusLabels[status].toLowerCase()}s.`}</p>
        : <ul className="review-list">
          {reviews.map((review) => <li key={review.id} className="review-item">
            <div className="review-main">
              <Stars value={review.rating} />
              <p>“{review.body}”</p>
              <p className="muted">
                <strong>{review.authorName}</strong>
                {review.productLabel && <> · compró {review.productLabel}</>}
                {" · "}{formatDate(review.createdAt)}
                {review.contact && <> · contacto: {review.contact}</>}
              </p>
            </div>
            <ReviewModeration id={review.id} status={review.status} />
          </li>)}
        </ul>}
    </section>
  </>;
}
