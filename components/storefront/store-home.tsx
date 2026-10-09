import Link from "next/link";
import { MessageCircle, Play, Star } from "lucide-react";
import { featuredProducts, formatPrice, groupProducts, orderHref, type Storefront } from "@/domain/config/storefront";
import { summarizeRatings, toPublicReview, type PublicReview } from "@/domain/storefront/reviews";
import { getReviewRepository } from "@/repositories";
import { storefrontWithInventory } from "@/services/store/inventory";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { ProductCard } from "./product-card";
import { ProductCatalog } from "./product-catalog";
import { ReviewForm } from "./review-form";
import { CategoryTiles, FindProductButton, HeroSearch, MixBuilder } from "./store-interactions";
import { StoreShell, storeContact } from "./store-shell";
import { Visual } from "./visual";

function Stars({ value, label }: { value: number; label: string }) {
  return <span className="st-stars" role="img" aria-label={label}>
    {[1, 2, 3, 4, 5].map((step) => <Star key={step} size={16} fill={value >= step - .25 ? "currentColor" : "none"} aria-hidden="true" />)}
  </span>;
}

/** Reseñas publicadas: las aprobadas en el panel más las importadas en el manifiesto. Si la base falla, sólo las del manifiesto. */
async function loadReviews(storefront: Storefront) {
  const imported: PublicReview[] = storefront.reviews.map((review, index) => ({ id: `m${index}`, rating: review.rating, body: review.text, authorName: review.author, productLabel: review.product, createdAt: review.date ?? "" }));
  try {
    const repository = getReviewRepository();
    const [approved, ratings] = await Promise.all([repository.listApproved(6), repository.approvedRatings()]);
    return { list: [...approved.map(toPublicReview), ...imported].slice(0, 6), summary: summarizeRatings([...ratings, ...storefront.reviews.map((review) => review.rating)]) };
  } catch (error) {
    console.error("store.reviews.load_failed", { message: error instanceof Error ? error.message : "unknown" });
    return { list: imported.slice(0, 6), summary: summarizeRatings(storefront.reviews.map((review) => review.rating)) };
  }
}

/** Portada de una edición que vende productos: vitrina, catálogo con carro, mix, mayoristas, reseñas e Instagram. */
export async function StoreHome({ storefront: manifest }: { storefront: Storefront }) {
  // Precios y stock de la base (o del ERP más adelante) sobre el catálogo del manifiesto.
  const storefront = await storefrontWithInventory(manifest);
  const brand = getBrandConfig();
  const edition = getEditionConfig();
  const contact = storeContact();
  const rules = storefront.pricing;
  const groups = groupProducts(storefront);
  const categoryOf = new Map(storefront.categories.map((category) => [category.key, category]));
  const featured = featuredProducts(storefront, 8);
  const tiles = groups.map((group) => ({ ...group.category, count: group.products.length, sample: group.category.description }));
  const { list: reviewList, summary: reviews } = await loadReviews(storefront);
  const wholesaleRows = groups.flatMap((group) => group.products.filter((product) => product.net && product.stock !== "out"));
  const posters = storefront.products.filter((product) => product.poster);
  const money = new Intl.NumberFormat(edition.locale, { style: "currency", currency: edition.pricing.currency, maximumFractionDigits: 0 });
  const productNames = new Map(storefront.products.map((product) => [product.key, product.name]));

  return <StoreShell storefront={storefront}>
    <main>
      <section className="st-hero">
        <div className="st-wrap st-hero-grid">
          <div className="st-hero-copy">
            <h1>{brand.heroTitle} <span>{brand.heroHighlight}</span></h1>
            <p className="st-lead">{brand.heroDescription}</p>
            <HeroSearch suggestions={storefront.suggestions} />
          </div>
          {storefront.heroImages.length > 0 && <div className="st-collage" data-count={storefront.heroImages.length}>
            {storefront.heroImages.map((item, index) => <Visual key={index} image={item.image} texture={item.texture} className="st-collage-item">
              {item.caption && <span className="st-collage-tag">{item.caption}{item.detail && <small>{item.detail}</small>}</span>}
            </Visual>)}
          </div>}
        </div>
      </section>

      <ul className="st-trust" aria-label="Cómo trabajamos">
        {storefront.highlights.map((item) => <li key={item.title} title={item.text}><span className="st-trust-mark" aria-hidden="true" />{item.title}</li>)}
        {reviews && <li><Stars value={reviews.average} label={`${reviews.average} de 5`} /> {reviews.average.toLocaleString(edition.locale)} en reseñas</li>}
      </ul>

      {posters.length > 0 && <section className="st-section st-section-tight st-section-new" aria-labelledby="st-t-new">
        <div className="st-wrap">
          <div className="st-head"><h2 id="st-t-new">Nuevo stock</h2><a href="#catalogo">Ver todo el catálogo</a></div>
          <ul className="st-posters">
            {posters.map((product) => {
              const price = formatPrice(product, product.formats.at(-1), rules);
              return <li key={product.key}>
                <Link href={`/productos/${product.key}`} className="st-poster">
                  {/* eslint-disable-next-line @next/next/no-img-element -- afiche vertical ya optimizado en /public */}
                  <img src={product.poster} alt={`Nuevo stock: ${product.name}`} width={768} height={1024} loading="lazy" />
                  <span className="st-poster-cta">{product.name}{price && <b>{money.format(price)}{product.formats.at(-1) ? ` · ${product.formats.at(-1)!.label}` : ""}</b>}</span>
                </Link>
              </li>;
            })}
          </ul>
        </div>
      </section>}

      <section className="st-section" id="categorias" aria-labelledby="st-t-cats">
        <div className="st-wrap">
          <div className="st-head"><h2 id="st-t-cats">¿Qué buscas hoy?</h2></div>
          <CategoryTiles categories={tiles} />
        </div>
      </section>

      <section className="st-section st-section-tight" aria-labelledby="st-t-top">
        <div className="st-wrap">
          <div className="st-head"><h2 id="st-t-top">Los más pedidos</h2><a href="#catalogo">Ver todo el catálogo</a></div>
          <div className="st-products st-products-featured">
            {featured.map((product) => <ProductCard key={product.key} product={product} category={categoryOf.get(product.category)} />)}
          </div>
        </div>
      </section>


      <section className="st-section" id="catalogo" aria-labelledby="st-t-catalog">
        <div className="st-wrap">
          <div className="st-head"><h2 id="st-t-catalog">{storefront.catalogTitle}</h2><p className="st-lead">{storefront.catalogDescription}</p></div>
          <ProductCatalog groups={groups} />
        </div>
      </section>

      {storefront.wholesale && <section className="st-section st-band-black" id="mayoristas" aria-labelledby="st-t-whole">
        <div className="st-wrap st-whole">
          <div className="st-whole-copy">
            <h2 id="st-t-whole">{storefront.wholesale.title}</h2>
            <p className="st-lead">{storefront.wholesale.text}</p>
            {rules.wholesaleMinimum && <p className="st-whole-min">Mínimo {rules.wholesaleMinimum} kg por producto · desde {rules.bulkFrom} kg, precio por volumen</p>}
            {storefront.wholesale.minimumOrderNet && <p className="st-whole-min">Pedido mínimo {money.format(storefront.wholesale.minimumOrderNet)} + IVA</p>}
            <div className="st-actions">
              <a className="st-btn st-btn-peach" href={orderHref(storefront.wholesale.ctaMessage, contact)} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> {storefront.wholesale.ctaLabel}</a>
            </div>
          </div>
          {wholesaleRows.length > 0 && <div className="st-table-wrap st-table-scroll" tabIndex={0} aria-label="Lista de precios mayorista">
            <table className="st-table">
              <caption className="sr-only">Precios mayoristas netos (sin IVA) por kilo o por unidad</caption>
              <thead><tr><th scope="col">Producto</th><th scope="col">Código</th><th scope="col" className="num">{rules.wholesaleMinimum ?? 3}–{rules.bulkFrom - 1} kg</th><th scope="col" className="num">{rules.bulkFrom}+ kg</th></tr></thead>
              <tbody>{wholesaleRows.map((product) => <tr key={product.key}>
                <td><span className="st-dot" style={{ background: categoryOf.get(product.category)?.color }} aria-hidden="true" /><Link href={`/productos/${product.key}`}>{product.name}</Link>{product.unit && <small> · por unidad</small>}</td>
                <td>{product.sku ?? product.formats[0]?.sku ?? "—"}</td>
                <td className="num">{money.format(product.net!.base)}</td>
                <td className="num">{money.format(product.net!.bulk ?? product.net!.base)}</td>
              </tr>)}</tbody>
            </table>
            <p className="st-table-note">Valores netos: se suma IVA (19%).</p>
          </div>}
        </div>
      </section>}

      {storefront.mix && <section className="st-section st-band-mix" id="mix" aria-labelledby="st-t-mix">
        <div className="st-wrap">
          <div className="st-head st-head-mix"><h2 id="st-t-mix">{storefront.mix.title}</h2><p className="st-lead">{storefront.mix.description}</p></div>
          <MixBuilder mix={storefront.mix} />
        </div>
      </section>}

      <section className="st-section" id="resenas" aria-labelledby="st-t-rev">
        <div className="st-wrap st-reviews">
          <div className="st-score">
            <h2 id="st-t-rev">Lo que dicen</h2>
            {reviews
              ? <><b>{reviews.average.toLocaleString(edition.locale)}</b>
                <Stars value={reviews.average} label={`${reviews.average} de 5 estrellas`} />
                <small>{reviews.count === 1 ? "1 reseña" : `${reviews.count} reseñas`} de clientes</small></>
              : <p className="st-score-empty">Todavía no hay reseñas publicadas. ¿Ya nos compraste? Cuéntanos cómo te fue.</p>}
          </div>
          <div className="st-reviews-side">
            {reviewList.length > 0 && <ul className="st-rev-list">
              {reviewList.map((review) => <li key={review.id} className="st-rev">
                <Stars value={review.rating} label={`${review.rating} de 5`} />
                <p>“{review.body}”</p>
                <span className="st-rev-who">{review.authorName}</span>
                {review.productLabel && <span className="st-rev-product">Compró {review.productLabel}</span>}
              </li>)}
            </ul>}
            <ReviewForm products={storefront.products.map((product) => product.name)} compact={reviewList.length > 0} />
          </div>
        </div>
      </section>

      {storefront.instagram && storefront.instagram.reels.length > 0 && <section className="st-section st-section-tight" aria-labelledby="st-t-ig">
        <div className="st-wrap">
          <div className="st-head"><h2 id="st-t-ig">Míralo en Instagram</h2><a href={`https://instagram.com/${storefront.instagram.handle}`} target="_blank" rel="noreferrer">@{storefront.instagram.handle}</a></div>
          <ul className="st-reels">
            {storefront.instagram.reels.map((reel) => <li key={reel.url}>
              <Visual image={reel.image} texture={reel.texture} className="st-reel">
                <a className="st-reel-link" href={reel.url} target="_blank" rel="noreferrer" aria-label={`Ver en Instagram: ${reel.title}`}><span className="st-play"><Play size={20} fill="currentColor" aria-hidden="true" /></span></a>
                <span className="st-reel-title">{reel.title}</span>
                {reel.product && <FindProductButton name={productNames.get(reel.product) ?? reel.product} className="st-reel-shop">Comprar {productNames.get(reel.product)?.toLowerCase()}</FindProductButton>}
              </Visual>
            </li>)}
          </ul>
        </div>
      </section>}

      <section className="st-section st-band-black" id="como-comprar" aria-labelledby="st-t-how">
        <div className="st-wrap">
          <div className="st-head"><h2 id="st-t-how">{storefront.howToBuyTitle}</h2></div>
          <ol className="st-steps">{storefront.howToBuy.map((step) => <li key={step.title}><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
        </div>
      </section>

      {storefront.deliveryNote && <section className="st-section st-band-peach" aria-labelledby="st-t-route">
        <div className="st-wrap">
          <div className="st-head"><h2 id="st-t-route">{storefront.deliveryTitle ?? "Despacho"}</h2><p className="st-lead">{storefront.deliveryNote}</p></div>
          {storefront.deliveryStops.length > 1 && <ol className="st-stops" aria-label="Recorrido de norte a sur">{storefront.deliveryStops.map((stop) => <li key={stop}>{stop}</li>)}</ol>}
        </div>
      </section>}
    </main>
  </StoreShell>;
}
