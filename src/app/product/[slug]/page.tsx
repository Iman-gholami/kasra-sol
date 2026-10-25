import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/products/product-detail';
import { ProductGrid } from '@/components/products/product-grid';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { categories, products as demoProducts } from '@/data/products';
import { getHomeProducts, getProductBySlug } from '@/lib/backend-products';

type Props = { params: Promise<{ slug: string }> };
// Pre-render the known demo catalog so product clicks can use full-route prefetching.
// With a live backend, don't bake sample items (or stock levels) into the build:
// the no-store API requests in backend-products.ts keep those routes dynamic.
export const dynamicParams = true;
export function generateStaticParams() {
  return process.env.BACKEND_INTERNAL_URL ? [] : demoProducts.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return { title: product?.name ?? 'محصول ناموجود', description: product?.description,
    openGraph: product ? { images: [product.images[0]] } : undefined };
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
    <Breadcrumbs items={[{ label: 'خانه', href: '/' }, { label: category?.title ?? 'محصولات', href: '/category/' + product.category }, { label: product.name }]}/>
    <ProductDetail product={product}/>
    <section className="related section-block" aria-labelledby="related-title">
      <div className="section-heading"><div><p className="section-kicker">ایده برای کنار هم پوشیدن</p><h2 id="related-title">این‌ها رو هم ببین</h2></div></div>
      <Suspense fallback={null}><RelatedProducts product={product}/></Suspense>
    </section>
  </div>;
}
