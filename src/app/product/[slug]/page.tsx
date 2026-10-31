import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/products/product-detail';
import { ProductGrid } from '@/components/products/product-grid';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { categories, products as demoProducts } from '@/data/products';
import { getHomeProducts, getProductBySlug } from '@/lib/backend-products';
import { pageMetadata, siteUrl, SITE_NAME } from '@/lib/seo';
import { shareImageFor, SHARE_SIZE } from '@/lib/share-image';
import { jsonLd, productJsonLd } from '@/lib/structured-data';

type Props = { params: Promise<{ slug: string }> };
// The inventory/price source can change independently of deployment.
// Keep product routes dynamic until static demo and live API catalogs have separate route contracts.
export const dynamic = 'force-dynamic';
export function generateStaticParams() { return demoProducts.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: 'محصول ناموجود' };
  // The JPEG share image of the first photo: messengers do not all show the AVIF/WebP photos themselves.
  const share = shareImageFor(product.images[0]);
  return { title: product.name, description: product.description, ...pageMetadata({ path: '/product/' + product.slug,
    title: product.name + ' | ' + SITE_NAME, description: product.description,
    image: share && { url: share.url, ...(share.card ? SHARE_SIZE : {}), alt: product.name } }) };
}
/** Related products are secondary: don't delay the buy box while the catalog API responds. */
async function RelatedProducts({ product }: { product: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>> }) {
  const products = await getHomeProducts();
  // Keep suggestions useful across outfits instead of repeating four near-identical portraits.
  const sameCategory = products.filter(candidate => candidate.id !== product.id && candidate.category === product.category).slice(0, 2);
  const otherCategories = ['shomiz', 'manto', 'tshirt']
    .filter(category => category !== product.category)
    .map(category => products.find(candidate => candidate.category === category)!)
    .filter(Boolean);
  return <ProductGrid products={[...sameCategory, ...otherCategories]}/>;
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();
  const category = categories.find(item => item.slug === product.category);
  return <div className="container">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(productJsonLd(product, siteUrl(), category?.title)) }}/>
    <Breadcrumbs items={[{ label: 'خانه', href: '/' }, { label: category?.title ?? 'محصولات', href: '/category/' + product.category }, { label: product.name }]}/>
    <ProductDetail product={product}/>
    <section className="related section-block" aria-labelledby="related-title">
      <div className="section-heading"><div><p className="section-kicker">ایده برای کنار هم پوشیدن</p><h2 id="related-title">این‌ها رو هم ببین</h2></div></div>
      <Suspense fallback={null}><RelatedProducts product={product}/></Suspense>
    </section>
  </div>;
}
