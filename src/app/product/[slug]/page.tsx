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
  const related = products.filter((candidate) => candidate.id !== product.id && candidate.category === product.category).slice(0,4);
  return <div className="container">
    <div className="breadcrumbs"><Link href="/">خانه</Link><span>/</span><Link href="/shop">محصولات</Link><span>/</span><span>{product.name}</span></div>
    <ProductDetail product={product} />
    <section className="related"><div className="section-heading"><div><p className="eyebrow">YOU MAY ALSO LIKE</p><h2>شاید این‌ها رو هم دوست داشته باشی</h2></div></div><ProductGrid products={related} /></section>
  </div>;
}
