import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';
import { parseFilters, queryProducts } from '@/lib/catalog';
import { pageMetadata, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = { title: 'همه محصولات', ...pageMetadata({ path: '/shop', title: 'همه محصولات | ' + SITE_NAME }) };
export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const data = await queryProducts(filters);
  return <CatalogView title="همه محصولات" intro="انتخاب‌هایی برای هر روز، با حال‌وهوای خودت." action="/shop" filters={filters} data={data} />;
}

export const dynamic = 'force-dynamic';
