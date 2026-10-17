import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';
import { parseFilters, queryProducts } from '@/lib/catalog';

export const metadata: Metadata = { title: 'همه محصولات' };
export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const data = await queryProducts(filters);
  return <CatalogView title="همه محصولات" intro="انتخاب‌هایی برای هر روز، با حال‌وهوای خودت." action="/shop" filters={filters} data={data} />;
}

export const dynamic = 'force-dynamic';
