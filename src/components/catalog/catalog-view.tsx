import Link from 'next/link';
import { ArrowLeft, ArrowRight, ImageIcon, X } from 'lucide-react';
import { CatalogFilters, SortForm } from '@/components/catalog/catalog-filters';
import { CatalogShell } from '@/components/catalog/catalog-shell';
import { ProductGrid } from '@/components/products/product-grid';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { allCategories, categories, palette } from '@/data/facets';
import { catalogHref, sortLabels } from '@/lib/catalog-url';
import { formatNumber } from '@/lib/format';
import type { CatalogFilters as Filters, Product } from '@/types/store';

type Props = {
  title: React.ReactNode;
  intro?: string;
  action: string;
  filters: Filters;
  data: { items: Product[]; total: number; page: number; pages: number };
  fixedCategory?: boolean;
  /** Search results render their own editable query above; the breadcrumb then says «جستجو». */
  compactHeading?: boolean;
  /** Plain-text name when `title` contains bidi-isolated user text (isolation adds spaces to computed names). */
  titleLabel?: string;
  /** Editorial number of a collection (۰۱, ۰۲ …), set beside the title as on the home contents strip. */
  number?: string;
};

export function CatalogView({ title, intro, action, filters, data, fixedCategory, compactHeading, titleLabel, number }: Props) {
  const makeUrl = (overrides: Record<string, string | null>) => catalogHref(action, filters, fixedCategory, overrides);
  const chips: { key: string; label: string }[] = [];
  if (filters.category && !fixedCategory) chips.push({ key: 'category', label: allCategories.find(c => c.slug === filters.category)?.title || '' });
  if (filters.size) chips.push({ key: 'size', label: 'سایز ' + filters.size });
  if (filters.color) chips.push({ key: 'color', label: palette.find(c => c.id === filters.color)?.name || filters.color });
  if (filters.min !== undefined) chips.push({ key: 'min', label: 'از ' + formatNumber(filters.min) + ' تومان' });
  if (filters.max !== undefined) chips.push({ key: 'max', label: 'تا ' + formatNumber(filters.max) + ' تومان' });
  if (filters.inStock) chips.push({ key: 'stock', label: 'فقط موجودها' });
  if (filters.discounted) chips.push({ key: 'sale', label: 'تخفیف‌دارها' });
  if (filters.sort && filters.sort !== 'featured') chips.push({ key: 'sort', label: sortLabels[filters.sort] });

  const clearHref = makeUrl({ category: null, size: null, color: null, min: null, max: null, stock: null, sale: null, sort: null, page: null });
  const allHref = action === '/search' ? makeUrl({ category: null, page: null }) : '/shop' + makeUrl({ category: null, page: null }).slice(action.length);
  const relaxHref = makeUrl({ size: null, color: null, min: null, max: null, stock: null, sale: null, page: null });
  const categoryHref = (slug: string) => action === '/search'
    ? makeUrl({ category: slug, page: null })
    : '/category/' + slug + makeUrl({ category: null, page: null }).slice(action.length);
  const selectedGroup = categories.find(group => group.slug === filters.category);
  const from = (data.page - 1) * 12 + 1;
  const to = from + data.items.length - 1;

  return <div className="container catalog-layout">
    <Breadcrumbs items={[{ label: 'خانه', href: '/' }, { label: typeof title === 'string' && !compactHeading ? title : 'جستجو' }]}/>
    <div className="catalog-heading">
      <div className="catalog-title">
        {number && <span className="catalog-number" aria-hidden="true">{number}</span>}
        <h1 aria-label={titleLabel}>{title}</h1>
        {intro && <p className="catalog-intro">{intro}</p>}
      </div>
      <p className="catalog-count" aria-live="polite"><strong>{formatNumber(data.total)}</strong> مدل</p>
    </div>
    <nav className="catalog-category-nav" aria-label="دسته‌بندی‌های محصولات">
      <Link href={allHref} className="chip" aria-current={!filters.category ? 'page' : undefined}>همه محصولات</Link>
      {categories.map(item => <Link key={item.slug} href={categoryHref(item.slug)} prefetch={false} className="chip"
        aria-current={filters.category === item.slug ? 'page' : undefined}>{item.title}</Link>)}
    </nav>
    {fixedCategory && selectedGroup && selectedGroup.children.length > 0 && <nav className="catalog-subcategory-nav" aria-label="زیرگروه‌های این دسته">
      <Link href={'/category/' + selectedGroup.slug} className="chip" aria-current="page">همه {selectedGroup.title}</Link>
      {selectedGroup.children.map(child => <Link key={child.slug} href={'/category/' + child.slug} prefetch={false} className="chip">{child.title}</Link>)}
    </nav>}
    <CatalogShell>
      <CatalogFilters action={action} filters={filters} fixedCategory={fixedCategory} count={data.total}/>
      <section className="catalog-results" aria-labelledby="results-title">
        <h2 id="results-title" className="sr-only">فهرست محصولات</h2>
        <div className="catalog-toolbar">
          <p className="catalog-toolbar-count">
            {data.total > 0 ? <>نمایش {formatNumber(from)}–{formatNumber(to)} از {formatNumber(data.total)} مدل</> : 'بدون نتیجه'}
          </p>
          <SortForm action={action} filters={filters} fixedCategory={fixedCategory}/>
        </div>
        {chips.length > 0 && <div className="active-filter-list">
          <p className="sr-only" id="active-filters-hint">فیلترهای فعال؛ برای حذف هر فیلتر آن را انتخاب کن.</p>
          <ul>
            {chips.map(chip => <li key={chip.key}>
              <Link className="chip active-filter-chip" href={makeUrl({ [chip.key]: null, page: null })} aria-describedby="active-filters-hint">
                {chip.label}<X size={14} aria-hidden="true"/>
              </Link>
            </li>)}
          </ul>
          <Link className="link-button clear-filter-link" href={clearHref}>پاک کردن همه</Link>
        </div>}
        {data.items.length ? <ProductGrid products={data.items} eagerCount={4}/> :
          <div className="empty-state">
            <h2>محصولی با این انتخاب‌ها پیدا نشد</h2>
            <p>می‌تونی یکی از فیلترها رو برداری، یا جستجوی تازه‌ای انجام بدی.</p>
            <div className="empty-actions">
              <Link className="btn btn-primary" href={relaxHref}>حذف محدودیت‌ها و دیدن محصولات</Link>
              <Link className="btn btn-secondary" href={clearHref}>بازنشانی همه فیلترها</Link>
              <Link className="btn btn-ghost" href={filters.q ? '/search' : '/shop'}>{filters.q ? 'جستجوی تازه' : 'همه محصولات'}</Link>
            </div>
          </div>}
        <p className="catalog-photo-note"><ImageIcon size={15} aria-hidden="true"/> عکس‌ها نمونه‌اند و ممکن است با جزئیات کالای نام‌برده یکسان نباشند.</p>
        {data.pages > 1 && <nav aria-label="صفحات نتایج" className="pagination">
          {data.page > 1
            ? <Link className="pagination-step" href={makeUrl({ page: String(data.page - 1) })}><ArrowRight size={18} aria-hidden="true"/>صفحه قبل</Link>
            : <span className="pagination-step" aria-hidden="true"/>}
          <ol>
            {Array.from({ length: data.pages }, (_, index) => index + 1).map(page => <li key={page}>
              {page === data.page
                ? <span aria-current="page" className="pagination-page"><span className="sr-only">صفحه </span>{formatNumber(page)}</span>
                : <Link className="pagination-page" href={makeUrl({ page: page === 1 ? null : String(page) })}>
                  <span className="sr-only">صفحه </span>{formatNumber(page)}</Link>}
            </li>)}
          </ol>
          {data.page < data.pages
            ? <Link className="pagination-step" href={makeUrl({ page: String(data.page + 1) })}>صفحه بعد<ArrowLeft size={18} aria-hidden="true"/></Link>
            : <span className="pagination-step" aria-hidden="true"/>}
        </nav>}
      </section>
    </CatalogShell>
  </div>;
}
