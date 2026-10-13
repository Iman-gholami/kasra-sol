import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';
import { parseFilters, queryProducts } from '@/lib/catalog';

export const metadata: Metadata = { title: 'جستجو', robots: { index: false, follow: false } };
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const data = filters.q ? await queryProducts(filters) : { items: [], total: 0, page: 1, pages: 1 };
  return <div><div className="container search-top">
    <p className="section-kicker">جستجو در کسری</p><h1>دنبال چی می‌گردی؟</h1>
    <form action="/search" role="search" className="search-line"><input id="search-query" type="search" name="q" defaultValue={filters.q ?? ''} aria-label="جستجوی محصولات" placeholder="مثلاً شومیز لینن..." required /><button type="submit" className="btn btn-dark">جستجو</button></form>
    </div>
    {filters.q ? <CatalogView title={'نتایج جستجو برای «' + filters.q + '»'} action="/search" filters={filters} data={data} /> : <div className="container empty-search">نام لباس یا دسته‌بندی را وارد کن تا نتایج را ببینی.</div>}
  </div>;
}
