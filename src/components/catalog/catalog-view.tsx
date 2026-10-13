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

  const clearHref = makeUrl({ category:null, size:null, color:null, min:null, max:null,
    stock:null, sale:null, sort:null, page:null });
  function categoryHref(slug:string) {
    if (action==='/search') return makeUrl({category:slug,page:null});
    const retained = makeUrl({category:null,page:null}).slice(action.length);
    return '/category/'+slug+retained;
  }

  return <div className="container catalog-layout">
    <div className="breadcrumbs"><Link href="/">خانه</Link><span>/</span><span>{title}</span></div>
    <div className="catalog-heading">
      <div><p className="section-kicker">کالکشن کسری</p><h1>{title}</h1>{intro && <p className="muted">{intro}</p>}</div>
      <p className="catalog-count">{formatNumber(data.total)} محصول نمایشی</p>
    </div>
    <div className="catalog-body">
      <CatalogFilters action={action} filters={filters} fixedCategory={fixedCategory} count={data.total}/>
      <section className="catalog-results" aria-label="نتایج محصولات">
        <nav className="catalog-category-nav" aria-label="دسته‌بندی‌های محصولات">
          <Link href={action === '/search' ? makeUrl({category:null,page:null}) : '/shop'}
            aria-current={!filters.category ? 'page' : undefined}>همه محصولات</Link>
          {categories.map(item => <Link key={item.slug} href={categoryHref(item.slug)}
             aria-current={filters.category===item.slug ? 'page' : undefined}>{item.title}</Link>)}
        </nav>
        <div className="catalog-toolbar">
          <span className="catalog-toolbar-count">{formatNumber(data.total)} مدل برای دیدن</span>
          <form className="catalog-sort-form" method="get" action={action}>
            {filters.q && <input type="hidden" name="q" value={filters.q}/>}
            {filters.category && !fixedCategory && <input type="hidden" name="category" value={filters.category}/>}
            {filters.size && <input type="hidden" name="size" value={filters.size}/>}
            {filters.color && <input type="hidden" name="color" value={filters.color}/>}
            {filters.min !== undefined && <input type="hidden" name="min" value={String(filters.min)}/>}
            {filters.max !== undefined && <input type="hidden" name="max" value={String(filters.max)}/>}
            {filters.inStock && <input type="hidden" name="stock" value="1"/>}
            {filters.discounted && <input type="hidden" name="sale" value="1"/>}
            <label htmlFor="catalog-sort">مرتب‌سازی</label>
            <select id="catalog-sort" name="sort" defaultValue={filters.sort ?? 'featured'}>
              <option value="featured">پیشنهادی</option><option value="newest">تازه‌ترین</option>
              <option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option>
            </select>
            <button type="submit" className="catalog-sort-apply">اعمال</button>
          </form>
        </div>
        <p className="catalog-photo-note">عکس‌های مدل نمونه‌اند و ممکن است با جزئیات کالای نام‌برده یکسان نباشند.</p>
        {chips.length > 0 && <div className="active-filter-list" aria-label="فیلترهای فعال">
          {chips.map(chip=><Link className="active-filter-chip" key={chip.key} href={makeUrl({[chip.key]:null,page:null})}>
            {chip.label}<X size={13} aria-hidden="true"/></Link>)}
          <Link className="clear-filter-link" href={clearHref}>پاک کردن فیلترها</Link>
        </div>}
        {data.items.length ? <ProductGrid products={data.items}/> :
          <div className="empty-state"><h2>محصولی با این انتخاب‌ها پیدا نشد</h2>
            <p>می‌تونی یکی از فیلترها رو برداری، یا جستجوی تازه‌ای انجام بدی.</p>
            <div className="discovery-empty-actions">
              <Link className="btn btn-dark" href={clearHref}>حذف فیلترها و دیدن نتایج</Link>
              <Link className="btn btn-outline" href={filters.q ? '/search' : '/shop'}>
                {filters.q ? 'جستجوی تازه' : 'همه محصولات'}
              </Link>
            </div></div>}
        {data.pages > 1 && <nav aria-label="صفحات نتایج" className="pagination">
          {data.page > 1 && <Link href={makeUrl({page:String(data.page-1)})}>صفحه قبل</Link>}
          <span>صفحه {formatNumber(data.page)} از {formatNumber(data.pages)}</span>
          {data.page < data.pages && <Link href={makeUrl({page:String(data.page+1)})}>صفحه بعد</Link>}
        </nav>}
      </section>
    </div>
  </div>;
}
