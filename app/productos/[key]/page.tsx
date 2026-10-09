import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductBuy } from "@/components/storefront/product-detail";
import { ProductCard } from "@/components/storefront/product-card";
import { StoreShell } from "@/components/storefront/store-shell";
import { Visual } from "@/components/storefront/visual";
import { formatPrice, type Storefront, type StoreProduct } from "@/domain/config/storefront";
import { productMetaDescription, productTitle } from "@/domain/storefront/seo";
import { getBrandConfig } from "@/lib/brand";
import { getEditionConfig } from "@/lib/edition";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getStorefront } from "@/lib/storefront";
import { storefrontWithInventory } from "@/services/store/inventory";
import "../../storefront.css";

/** Precio y stock vienen del inventario: se regenera cada 5 minutos y al editar el inventario. */
export const revalidate = 300;
export const dynamicParams = false;

type Params = Promise<{ key: string }>;

export function generateStaticParams() {
  return (getStorefront()?.products ?? []).map((product) => ({ key: product.key }));
}

async function load(key: string) {
  const manifest = getStorefront();
  if (!manifest) return undefined;
  const storefront = await storefrontWithInventory(manifest);
  const product = storefront.products.find((item) => item.key === key);
  return product ? { storefront, product, category: storefront.categories.find((item) => item.key === product.category) } : undefined;
}

/** Presentación más barata con precio, para "desde $X". */
function cheapest(storefront: Storefront, product: StoreProduct) {
  const options = product.formats.length ? product.formats.filter((format) => format.stock !== "out") : [undefined];
  const priced = options.map((format) => ({ format, price: formatPrice(product, format, storefront.pricing) })).filter((item) => item.price);
  return priced.sort((a, b) => a.price! - b.price!)[0];
}

function money(amount: number) {
  const edition = getEditionConfig();
  return new Intl.NumberFormat(edition.locale, { style: "currency", currency: edition.pricing.currency, maximumFractionDigits: 0 }).format(amount);
}

const soldOut = (product: StoreProduct) => product.formats.length ? product.formats.every((format) => format.stock === "out") : product.stock === "out";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { key } = await params;
  const found = await load(key);
  if (!found) return {};
  const { storefront, product, category } = found;
  const brand = getBrandConfig();
  const from = cheapest(storefront, product);
  const title = productTitle(product, !product.unit && product.formats.length > 0);
  const description = productMetaDescription({
    name: product.name,
    description: product.description,
    categoryName: category?.name,
    priceFrom: from ? { amount: money(from.price!), format: from.format?.label ?? product.unit } : undefined,
    soldOut: soldOut(product),
    closing: storefront.deliveryStops.length > 1 ? "Despacho a todo Chile." : undefined,
  });
  const path = `/productos/${product.key}`;
  const images = product.image ? [{ url: product.image, alt: product.name }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: brand.name, locale: getEditionConfig().locale.replace("-", "_"), title: `${title} | ${brand.name}`, description, url: path, ...(images ? { images } : {}) },
    twitter: { card: images ? "summary_large_image" : "summary", title: `${title} | ${brand.name}`, description, ...(images ? { images: images.map((image) => image.url) } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { key } = await params;
  const found = await load(key);
  if (!found) notFound();
  const { storefront, product, category } = found;
  const brand = getBrandConfig();
  const edition = getEditionConfig();
  const siteUrl = getPublicSiteUrl();
  const url = new URL(`/productos/${product.key}`, siteUrl).toString();
  const related = storefront.products.filter((item) => item.category === product.category && item.key !== product.key && !soldOut(item)).slice(0, 4);
  const prices = (product.formats.length ? product.formats : [undefined]).map((format) => formatPrice(product, format, storefront.pricing)).filter((price): price is number => Boolean(price));
  const sku = product.sku ?? product.formats.find((format) => format.sku)?.sku;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        description: product.description,
        url,
        ...(product.image ? { image: new URL(product.image, siteUrl).toString() } : {}),
        ...(sku ? { sku } : {}),
        ...(category ? { category: category.name } : {}),
        brand: { "@type": "Brand", name: brand.name },
        ...(prices.length ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: edition.pricing.currency,
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: prices.length,
            availability: soldOut(product) ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
            seller: { "@type": "Organization", name: brand.name },
          },
        } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: siteUrl.toString() },
          ...(category ? [{ "@type": "ListItem", position: 2, name: category.name, item: new URL(`/#cat-${category.key}`, siteUrl).toString() }] : []),
          { "@type": "ListItem", position: category ? 3 : 2, name: product.name, item: url },
        ],
      },
    ],
  };

  return <StoreShell storefront={storefront}>
    <main className="st-pd">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="st-wrap">
        <nav className="st-crumbs" aria-label="Ruta">
          <Link href="/">Inicio</Link><ChevronRight size={14} aria-hidden="true" />
          {category && <><a href={`/#cat-${category.key}`}>{category.name}</a><ChevronRight size={14} aria-hidden="true" /></>}
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="st-pd-grid">
          <figure className="st-pd-media">
            <Visual image={product.image} texture={product.texture} className="st-pd-photo" label={product.image ? product.name : undefined}>
              {product.tags[0] && <span className="st-chip">{product.tags[0]}</span>}
            </Visual>
            {product.image && product.imageIsReferential && <figcaption>Imagen referencial.</figcaption>}
          </figure>
          <div className="st-pd-info">
            {category && <a className="st-pd-cat" href={`/#cat-${category.key}`} style={category.color ? { background: category.color, color: category.darkText ? "#1A100A" : "#FFFFFF" } : undefined}>{category.name}</a>}
            <h1>{product.name}</h1>
            {product.description && <p className="st-lead">{product.description}</p>}
            {product.tags.length > 1 && <ul className="st-pd-tags">{product.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
            <ProductBuy product={product} wholesaleMinimum={storefront.pricing.wholesaleMinimum} />
            <dl className="st-pd-facts">
              {sku && <><dt>Código</dt><dd>{sku}</dd></>}
              <dt>Venta</dt><dd>{product.unit ? `Por unidad (${product.unit})` : product.formats.length ? `Por kilo, en ${product.formats.map((format) => format.label).join(" o ")}` : "Por kilo"}</dd>
              {storefront.deliveryNote && <><dt>Despacho</dt><dd>{storefront.deliveryNote}</dd></>}
            </dl>
          </div>
        </div>

        {related.length > 0 && <section className="st-section st-section-tight" aria-labelledby="st-t-related">
          <div className="st-head"><h2 id="st-t-related">También en {category?.name.toLowerCase() ?? "la tienda"}</h2><a href={category ? `/#cat-${category.key}` : "/#catalogo"}>Ver todos</a></div>
          <div className="st-products">{related.map((item) => <ProductCard key={item.key} product={item} category={category} />)}</div>
        </section>}
      </div>
    </main>
  </StoreShell>;
}
