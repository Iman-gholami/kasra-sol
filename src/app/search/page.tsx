import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { CatalogView } from '@/components/catalog/catalog-view';
import { CollectionCircles } from '@/components/home/collection-circles';
import { parseFilters, queryProducts } from '@/lib/catalog';

export const metadata: Metadata = { title: 'جستجو', robots: { index: false, follow: false } };
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const data = filters.q ? await queryProducts(filters) : { items: [], total: 0, page: 1, pages: 1 };
  return <div>
    <div className={'container search-top' + (filters.q ? ' search-top-compact' : '')}>
      {filters.q ? <p className="section-kicker">ویرایش جستجو</p> : <>
        <p className="section-kicker">جستجو در کسری</p><h1>دنبال چی می‌گردی؟</h1>
      </>}
      <form action="/search" role="search" className="search-line">
        <Search size={20} aria-hidden="true"/>
        <input id="search-query" type="search" name="q" defaultValue={filters.q ?? ''} aria-label="جستجوی محصولات"
          placeholder="مثلاً شومیز لینن" required enterKeyHint="search" autoComplete="off"/>
        <button type="submit" className="btn btn-primary btn-sm">جستجو</button>
      </form>
    </div>
    {filters.q
      ? <CatalogView title={<>نتایج جستجو برای «<span dir="auto">{filters.q}</span>»</>} titleLabel={'نتایج جستجو برای «' + filters.q + '»'} action="/search" filters={filters} data={data} compactHeading/>
      : <div className="container empty-search">
        <p>نام لباس، رنگ یا دسته‌بندی را بنویس تا نتیجه‌ها را ببینی.</p>
        <CollectionCircles/>
      </div>}
  </div>;
}

export const dynamic = 'force-dynamic';
