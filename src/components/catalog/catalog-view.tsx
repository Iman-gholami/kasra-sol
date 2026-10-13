import Link from 'next/link';
import { X } from 'lucide-react';
import { CatalogFilters } from '@/components/catalog/catalog-filters';
import { ProductGrid } from '@/components/products/product-grid';
import { categories } from '@/data/products';
import { formatNumber } from '@/lib/format';
import type { CatalogFilters as Filters, Product } from '@/types/store';

type Props = {
  title: string;
  intro?: string;
  action: string;
  filters: Filters;
  data: { items: Product[]; total: number; page: number; pages: number };
  fixedCategory?: boolean;
};
const colorLabels: Record<string,string> = {
  cream:'کرم', black:'مشکی', rose:'رز خاکی', sage:'سبز سدری', blue:'آبی دودی', white:'سفید'
};

export function CatalogView({ title, intro, action, filters, data, fixedCategory }: Props) {
  const makeUrl = (overrides: Record<string,string|null>) => {
    const params = new URLSearchParams();
    if (filters.category && !fixedCategory) params.set('category', filters.category);
    if (filters.q) params.set('q', filters.q);
    if (filters.size) params.set('size', filters.size);
    if (filters.color) params.set('color', filters.color);
    if (filters.min !== undefined) params.set('min', String(filters.min));
    if (filters.max !== undefined) params.set('max', String(filters.max));
    if (filters.inStock) params.set('stock', '1');
    if (filters.discounted) params.set('sale', '1');
    if (filters.sort && filters.sort !== 'featured') params.set('sort', filters.sort);
    for (const [key,value] of Object.entries(overrides)) {
      if (value === null) params.delete(key); else params.set(key,value);
    }
    const query = params.toString();
    return action + (query ? '?' + query : '');
  };
  const chips: { key: string; label: string }[] = [];
  if (filters.category && !fixedCategory)
    chips.push({key:'category',label:categories.find(c=>c.slug===filters.category)?.title || ''});
  if (filters.size) chips.push({key:'size',label:'سایز '+filters.size});
  if (filters.color) chips.push({key:'color',label:colorLabels[filters.color] || filters.color});
  if (filters.min !== undefined) chips.push({key:'min',label:'از '+formatNumber(filters.min)+' تومان'});
  if (filters.max !== undefined) chips.push({key:'max',label:'تا '+formatNumber(filters.max)+' تومان'});
  if (filters.inStock) chips.push({key:'stock',label:'فقط موجودها'});
  if (filters.discounted) chips.push({key:'sale',label:'تخفیف‌دارها'});
  if (filters.sort && filters.sort!=='featured') chips.push({key:'sort',label:filters.sort==='newest'?'جدیدترین':filters.sort==='price-asc'?'ارزان‌ترین':'گران‌ترین'});

  return <div className="container catalog-layout">
    <div className="breadcrumbs"><Link href="/">خانه</Link><span>/</span><span>{title}</span></div>
    <div className="catalog-heading">
      <div><p className="eyebrow">THE KASRA COLLECTION</p><h1>{title}</h1>{intro && <p className="muted">{intro}</p>}</div>
      <p className="catalog-count">{formatNumber(data.total)} محصول</p>
    </div>
    <div className="catalog-body">
      <CatalogFilters action={action} filters={filters} fixedCategory={fixedCategory} count={data.total}/>
      <section className="catalog-results" aria-label="نتایج محصولات">
        {chips.length > 0 && <div className="active-filter-list" aria-label="فیلترهای فعال">
          {chips.map(chip=><Link className="active-filter-chip" key={chip.key} href={makeUrl({[chip.key]:null,page:null})}>
            {chip.label}<X size={13} aria-hidden="true"/></Link>)}
          <Link className="clear-filter-link" href={action}>پاک کردن همه</Link>
        </div>}
        {data.items.length ? <ProductGrid products={data.items}/> :
          <div className="empty-state"><h2>محصولی پیدا نشد</h2><p>فیلترها را تغییر بده یا دوباره جستجو کن.</p>
            <Link className="btn btn-dark" href={action}>نمایش همه محصولات</Link></div>}
        {data.pages > 1 && <nav aria-label="صفحات نتایج" className="pagination">
          {data.page > 1 && <Link href={makeUrl({page:String(data.page-1)})}>صفحه قبل</Link>}
          <span>صفحه {formatNumber(data.page)} از {formatNumber(data.pages)}</span>
          {data.page < data.pages && <Link href={makeUrl({page:String(data.page+1)})}>صفحه بعد</Link>}
        </nav>}
      </section>
    </div>
  </div>;
}
