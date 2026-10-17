import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CatalogView } from '@/components/catalog/catalog-view';
import { categories, getCategory } from '@/data/products';
import { parseFilters, queryProducts } from '@/lib/catalog';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export function generateStaticParams() { return categories.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getCategory((await params).slug);
  return { title: category?.title ?? 'دسته‌بندی ناموجود', description: category?.description };
}
export default async function CategoryPage({ params, searchParams }: Props) {
  const category = getCategory((await params).slug);
  if (!category) notFound();
  const filters = parseFilters(await searchParams, category.slug);
  const data = await queryProducts(filters);
  return <CatalogView title={category.title} intro={category.description} action={'/category/' + category.slug} fixedCategory filters={filters} data={data} />;
}

export const dynamic = 'force-dynamic';
