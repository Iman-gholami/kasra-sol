import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/products/product-detail';
import { ProductGrid } from '@/components/products/product-grid';
import { bySlug, products } from '@/data/products';

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return products.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = bySlug((await params).slug);
  return { title: product?.name ?? 'محصول ناموجود', description: product?.description,
    openGraph: product ? { images: [product.images[0]] } : undefined };
}
export default async function ProductPage({ params }: Props) {
  const product = bySlug((await params).slug);
  if (!product) notFound();
  // Keep suggestions useful across outfits instead of repeating four almost identical demo portraits.
  // Prefer two neighboring styles from this category and one complementary style from each other category.
  const sameCategory = products.filter(candidate => candidate.id !== product.id && candidate.category === product.category).slice(0, 2);
  const otherCategories = ['shomiz', 'manto', 'tshirt']
    .filter(category => category !== product.category)
    .map(category => products.find(candidate => candidate.category === category)!)
    .filter(Boolean);
  const related = [...sameCategory, ...otherCategories];
  return <div className="container">
    <div className="breadcrumbs"><Link href="/">خانه</Link><span>/</span><Link href="/shop">محصولات</Link><span>/</span><span>{product.name}</span></div>
    <ProductDetail product={product} />
    <section className="related"><div className="section-heading"><div><p className="section-kicker">ایده برای کنار هم پوشیدن</p><h2>این‌ها رو هم ببین</h2></div></div><ProductGrid products={related} /></section>
  </div>;
}
