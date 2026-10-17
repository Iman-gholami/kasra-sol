import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/products/product-detail';
import { ProductGrid } from '@/components/products/product-grid';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { categories, products as demoProducts } from '@/data/products';
import { getHomeProducts, getProductBySlug } from '@/lib/backend-products';

type Props = { params: Promise<{ slug: string }> };
export const dynamic = 'force-dynamic';
export function generateStaticParams() { return demoProducts.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return { title: product?.name ?? 'محصول ناموجود', description: product?.description,
    openGraph: product ? { images: [product.images[0]] } : undefined };
}
export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  const products = await getHomeProducts();
  if (!product) notFound();
  // Keep suggestions useful across outfits instead of repeating four almost identical demo portraits.
  // Prefer two neighboring styles from this category and one complementary style from each other category.
  const sameCategory = products.filter(candidate => candidate.id !== product.id && candidate.category === product.category).slice(0, 2);
  const otherCategories = ['shomiz', 'manto', 'tshirt']
    .filter(category => category !== product.category)
    .map(category => products.find(candidate => candidate.category === category)!)
    .filter(Boolean);
  const related = [...sameCategory, ...otherCategories];
  const category = categories.find(item => item.slug === product.category);
  return <div className="container">
    <Breadcrumbs items={[{ label: 'خانه', href: '/' }, { label: category?.title ?? 'محصولات', href: '/category/' + product.category }, { label: product.name }]}/>
    <ProductDetail product={product}/>
    <section className="related section-block" aria-labelledby="related-title">
      <div className="section-heading"><div><p className="section-kicker">ایده برای کنار هم پوشیدن</p><h2 id="related-title">این‌ها رو هم ببین</h2></div></div>
      <ProductGrid products={related}/>
    </section>
  </div>;
}
