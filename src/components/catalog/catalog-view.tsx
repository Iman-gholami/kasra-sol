import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { ProductGrid } from '@/components/products/product-grid';
import { categories } from '@/data/products';
import { formatNumber } from '@/lib/format';
import type { CatalogFilters, Product } from '@/types/store';

type Props = {
  title: string;
  intro?: string;
  action: string;
  filters: CatalogFilters;
  data: { items: Product[]; total: number; page: number; pages: number };
  fixedCategory?: boolean;
};

export function CatalogView({ title, intro, action, filters, data, fixedCategory }: Props) {
  const url = (page: number) => {
    const params = new URLSearchParams();
    if (filters.category && !fixedCategory) params.set('category', filters.category);
    if (filters.q) params.set('q', filters.q);
    if (filters.size) params.set('size', filters.size);
    if (filters.color) params.set('color', filters.color);
    if (filters.min !== undefined) params.set('min', String(filters.min));
    if (filters.max !== undefined) params.set('max', String(filters.max));
    if (filters.inStock) params.set('stock', '1');
    if (filters.discounted) params.set('sale', '1');
    if (filters.sort) params.set('sort', filters.sort);
    params.set('page', String(page));
    return action + '?' + params.toString();
  };
  return <div className="container catalog-layout">
    <div className="breadcrumbs"><Link href="/">خانه</Link><span>/</span><span>{title}</span></div>
    <div className="catalog-heading"><div><p className="eyebrow">KASRA / COLLECTIONS</p><h1>{title}</h1>{intro && <p className="muted">{intro}</p>}</div><p className="catalog-count">{formatNumber(data.total)} محصول</p></div>
    <div className="catalog-body">
      <aside className="filters-panel">
        <details className="filter-details" open>
          <summary><SlidersHorizontal size={18} /> فیلتر و مرتب‌سازی</summary>
          <form method="get" action={action} className="filter-form">
            {filters.q && <input type="hidden" name="q" value={filters.q} />}
            {!fixedCategory && <label>دسته‌بندی<select name="category" defaultValue={filters.category ?? ''}><option value="">همه دسته‌ها</option>{categories.map((category) =>
              <option value={category.slug} key={category.slug}>{category.title}</option>)}</select></label>}
            <label>سایز<select name="size" defaultValue={filters.size ?? ''}><option value="">همه سایزها</option>{['S','M','L','XL'].map((size) =>
              <option key={size} value={size}>{size}</option>)}</select></label>
            <label>رنگ<select name="color" defaultValue={filters.color ?? ''}>
              <option value="">همه رنگ‌ها</option><option value="cream">کرم</option><option value="black">مشکی</option><option value="rose">رز خاکی</option><option value="sage">سبز سدری</option><option value="blue">آبی دودی</option><option value="white">سفید</option>
            </select></label>
            <div className="price-fields"><label>حداقل قیمت (تومان)<input type="number" inputMode="numeric" name="min" min="0" placeholder="از" defaultValue={filters.min ?? ''} /></label>
              <label>حداکثر قیمت (تومان)<input type="number" inputMode="numeric" name="max" min="0" placeholder="تا" defaultValue={filters.max ?? ''} /></label></div>
            <label>مرتب‌سازی<select name="sort" defaultValue={filters.sort ?? 'featured'}>
              <option value="featured">پیشنهادی</option><option value="newest">جدیدترین</option><option value="price-asc">ارزان‌ترین</option><option value="price-desc">گران‌ترین</option>
            </select></label>
            <label className="check-row"><input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock} /> فقط موجودها</label>
            <label className="check-row"><input type="checkbox" name="sale" value="1" defaultChecked={filters.discounted} /> فقط تخفیف‌دارها</label>
            <div className="filter-buttons"><button className="btn btn-dark" type="submit">اعمال فیلترها</button><Link href={action} className="btn btn-line">حذف فیلترها</Link></div>
          </form>
        </details>
      </aside>
      <section className="catalog-results" aria-label="نتایج محصولات">
        {data.items.length ? <ProductGrid products={data.items} /> :
          <div className="empty-state"><h2>محصولی پیدا نشد</h2><p>فیلترها را تغییر بده یا از نو شروع کن.</p><Link className="btn btn-dark" href={action}>نمایش همه محصولات</Link></div>}
        {data.pages > 1 && <nav aria-label="صفحات نتایج" className="pagination">
          {data.page > 1 && <Link href={url(data.page - 1)}>صفحه قبل</Link>}
          <span>صفحه {formatNumber(data.page)} از {formatNumber(data.pages)}</span>
          {data.page < data.pages && <Link href={url(data.page + 1)}>صفحه بعد</Link>}
        </nav>}
      </section>
    </div>
  </div>;
}
