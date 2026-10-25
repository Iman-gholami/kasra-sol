'use client';

import { Fragment, useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Archive, ChevronDown, ChevronUp, Copy, ImageIcon, PackageSearch, Pencil, Plus, Search, Send } from 'lucide-react';
import { adminApi, AdminApiError, errorMessage } from '@/components/admin/admin-api';
import { CATEGORY, digitsOnly, formatNumber, formatToman, PRODUCT_STATUS } from '@/components/admin/labels';
import { Badge, Loading, Notice, Pager } from '@/components/admin/ui';
import { categories } from '@/data/facets';

export type ProductRow = {
  id: string; name: string; slug: string; category: string; price: number; compareAt: number | null;
  stock: number; active: boolean; status: 'active' | 'draft' | 'archived'; images?: string[];
  variantCount: number; lowVariants: number; emptyVariants: number;
};
type ProductPage = { items: ProductRow[]; total: number; page: number; pages: number };
type Variant = { id: string; color_id: string; color_name: string; size: string; stock: number };

function Row({ product, permissions, changed, edit, duplicate }: {
  product: ProductRow; permissions: string[]; changed: () => void; edit: (id: string) => void; duplicate?: (id: string) => void;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [savedPrice, setSavedPrice] = useState(product.price);
  // After a reload the row keeps its notices but shows the stored price (derived state, set during render).
  if (savedPrice !== product.price) { setSavedPrice(product.price); setPrice(String(product.price)); }
  const [expanded, setExpanded] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stocks, setStocks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const can = (permission: string) => permissions.includes(permission);

  async function run(task: () => Promise<string | void>) {
    setBusy(true); setNotice(null);
    try { const text = await task(); if (text) setNotice({ tone: 'success', text }); }
    catch (error) { setNotice({ tone: 'error', text: errorMessage(error) }); }
    finally { setBusy(false); }
  }
  async function loadVariants() {
    const result = await adminApi<{ items: Variant[] }>('products/' + product.id + '/variants');
    setVariants(result.items);
    setStocks(Object.fromEntries(result.items.map(v => [v.id, String(v.stock)])));
  }
  const savePrice = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await adminApi('products/' + product.id + '/price', { method: 'PATCH', body: { price: Number(price) } });
      changed();
      return 'قیمت ذخیره شد.';
    });
  };
  const toggleVisibility = () => {
    const publishing = !product.active;
    if (!window.confirm(publishing ? 'این محصول در فروشگاه منتشر شود؟'
      : 'محصول از ویترین برداشته و آرشیو شود؟ سفارش‌های قبلی و اطلاعات آن حفظ می‌شود.')) return;
    void run(async () => {
      await adminApi('products/' + product.id + '/visibility', { method: 'PATCH', body: { active: publishing } });
      changed();
    });
  };
  const toggleVariants = () => {
    if (expanded) { setExpanded(false); return; }
    void run(async () => { await loadVariants(); setExpanded(true); });
  };
  const saveStock = (variant: Variant) => run(async () => {
    try {
      await adminApi('variants/' + variant.id + '/stock', { method: 'PATCH',
        body: { stock: Number(stocks[variant.id]), expectedStock: variant.stock } });
    } catch (error) {
      // Someone ordered meanwhile: show the real stock instead of overwriting it.
      if (error instanceof AdminApiError && error.code === 'stock_changed') await loadVariants();
      throw error;
    }
    await loadVariants();
    changed();
    return 'موجودی ' + variant.color_name + ' / ' + variant.size + ' ذخیره شد.';
  });
  const status = PRODUCT_STATUS[product.status];
  const stockClass = product.stock <= 0 ? 'admin-stock-none' : product.lowVariants > 0 ? 'admin-stock-low' : 'admin-stock-good';
  return <Fragment>
    <tr className={expanded ? 'admin-row-expanded' : undefined}>
      <td data-label="محصول">
        <div className="admin-product-title">
          <span className="admin-product-image">
            {product.images?.[0] ? <Image src={product.images[0]} alt="" width={54} height={62}
              unoptimized className="h-full w-full object-cover"/> : <ImageIcon size={22} aria-hidden="true"/>}
          </span>
          <div className="min-w-0">
            <div className="admin-product-name">{product.name}</div>
            <div className="admin-product-sub">{product.id}</div>
            <div className="admin-sub">{CATEGORY[product.category] ?? product.category}</div>
          </div>
        </div>
      </td>
      <td data-label="وضعیت"><Badge tone={status.tone}>{status.label}</Badge></td>
      <td data-label="موجودی کل"><span className={stockClass}>{formatNumber(product.stock)} عدد</span>
        {(product.lowVariants > 0 || product.emptyVariants > 0) && <span className="admin-sub">
          {[product.emptyVariants > 0 && formatNumber(product.emptyVariants) + ' ترکیب ناموجود',
            product.lowVariants > 0 && formatNumber(product.lowVariants) + ' ترکیب کم‌موجود'].filter(Boolean).join(' · ')}</span>}</td>
      <td data-label="قیمت">
        {can('products:price') ? <form className="admin-price-form" onSubmit={savePrice}>
          <input type="text" inputMode="numeric" maxLength={10} required dir="ltr" value={price}
            aria-label={'قیمت فروش ' + product.name + ' به تومان'} onChange={event => setPrice(digitsOnly(event.target.value))}/>
          <button className="admin-btn admin-btn-primary admin-btn-small" disabled={busy || price === '' || Number(price) === product.price}
            type="submit">ثبت</button>
        </form> : <span className="admin-nowrap">{formatToman(product.price)}</span>}
        {product.compareAt ? <span className="admin-sub">قبل از تخفیف: {formatToman(product.compareAt)}</span> : null}
      </td>
      <td data-label="مدیریت">
        <div className="admin-table-actions">
          {can('products:write') && <button className="admin-btn admin-btn-outline admin-btn-small" onClick={() => edit(product.id)}
            type="button" aria-label={'ویرایش ' + product.name}><Pencil size={13} aria-hidden="true"/> ویرایش</button>}
          {duplicate && <button className="admin-btn admin-btn-outline admin-btn-small" onClick={() => duplicate(product.id)}
            type="button" aria-label={'کپی ' + product.name + ' به‌عنوان محصول جدید'}><Copy size={13} aria-hidden="true"/> کپی</button>}
          {can('inventory:read') && <button type="button" disabled={busy}
            aria-expanded={expanded} aria-label={'موجودی رنگ و سایز ' + product.name}
            className="admin-btn admin-btn-outline admin-btn-small" onClick={toggleVariants}>
            {expanded ? <ChevronUp size={14} aria-hidden="true"/> : <ChevronDown size={14} aria-hidden="true"/>}
            موجودی</button>}
          {can('products:write') && <button type="button" disabled={busy}
            className={'admin-btn admin-btn-small ' + (product.active ? 'admin-btn-danger' : 'admin-btn-outline')}
            aria-label={(product.active ? 'آرشیو ' : 'انتشار ') + product.name} onClick={toggleVisibility}>
            {product.active ? <Archive size={13} aria-hidden="true"/> : <Send size={13} aria-hidden="true"/>}
            {product.active ? 'آرشیو' : 'انتشار'}</button>}
        </div>
        {notice && <Notice tone={notice.tone} className="admin-notice-compact">{notice.text}</Notice>}
      </td>
    </tr>
    {expanded && <tr className="admin-variant-row"><td colSpan={5}>
      <div className="admin-variant-detail">
        <h3 className="admin-section-title">موجودی رنگ‌ها و سایزهای {product.name}</h3>
        <div className="admin-variant-grid">
          {variants.map(variant => <div key={variant.id} className="admin-variant-card">
            <span>{variant.color_name} / <bdi>{variant.size}</bdi>
              <small className="admin-sub">موجودی فعلی: {formatNumber(variant.stock)}</small></span>
            {can('inventory:write') && <div className="admin-inline">
              <input type="text" inputMode="numeric" maxLength={7} dir="ltr"
                aria-label={'موجودی جدید ' + variant.color_name + ' سایز ' + variant.size}
                value={stocks[variant.id] ?? ''} onChange={event => setStocks(s => ({ ...s, [variant.id]: digitsOnly(event.target.value) }))}/>
              <button type="button" disabled={busy || stocks[variant.id] === '' || Number(stocks[variant.id]) === variant.stock}
                className="admin-btn admin-btn-primary admin-btn-small" onClick={() => void saveStock(variant)}>ثبت</button>
            </div>}
          </div>)}
          {!variants.length && <p className="admin-sub">برای این محصول ترکیب رنگ و سایزی تعریف نشده است.</p>}
        </div>
      </div>
    </td></tr>}
  </Fragment>;
}

export function ProductList({ permissions, edit, create, duplicate, initialQuery = '' }: {
  permissions: string[]; edit: (id: string) => void; create: () => void; duplicate: (id: string) => void; initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [search, setSearch] = useState(initialQuery.trim());
  const [status, setStatus] = useState('all');
  const [stock, setStock] = useState('all');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState<ProductPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ status, stock, page: String(page), limit: '20', ...(search ? { q: search } : {}), ...(category ? { category } : {}) });
    adminApi<ProductPage>('products?' + params, { signal: controller.signal })
      .then(result => { setData(result); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, status, stock, category, page, version]);
  const reload = () => setVersion(v => v + 1);
  const canCreate = ['products:write', 'products:price'].every(p => permissions.includes(p));
  function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setPage(1); setSearch(query.trim());
  }
  const filtered = Boolean(search) || status !== 'all' || stock !== 'all' || Boolean(category);
  return <div className="admin-stack">
    <div className="admin-toolbar">
      <div>
        <h2 className="admin-toolbar-heading">مدیریت محصولات</h2>
        <p className="admin-toolbar-desc">قیمت‌گذاری، موجودی رنگ و سایز، انتشار و آرشیو محصولات فروشگاه</p>
      </div>
      {canCreate && <button type="button" onClick={create} className="admin-btn admin-btn-primary">
        <Plus size={17} aria-hidden="true"/> افزودن محصول
      </button>}
    </div>
    <section className="admin-panel" aria-labelledby="product-list-heading">
      <div className="admin-panel-head">
        <div>
          <h3 id="product-list-heading">فهرست محصولات {data && <span className="admin-count">({formatNumber(data.total)})</span>}</h3>
          <p>جست‌وجو و فیلتر روی کل کاتالوگ انجام می‌شود.</p>
        </div>
        <div className="admin-toolbar-controls">
          <form role="search" onSubmit={submit} className="admin-search-form">
            <label className="admin-search-field"><span className="sr-only">جست‌وجوی محصول</span>
              <Search size={17} aria-hidden="true"/>
              <input type="search" placeholder="نام، کد یا آدرس محصول" value={query}
                onChange={event => setQuery(event.target.value)}/>
            </label>
            <button type="submit" className="admin-btn admin-btn-outline">جست‌وجو</button>
          </form>
          <label className="admin-inline-field"><span className="sr-only">فیلتر وضعیت انتشار</span>
            <select value={status} onChange={event => { setLoading(true); setPage(1); setStatus(event.target.value); }}>
              <option value="all">همه وضعیت‌ها</option><option value="active">منتشرشده</option>
              <option value="draft">پیش‌نویس</option><option value="archived">آرشیوشده</option>
            </select>
          </label>
          <label className="admin-inline-field"><span className="sr-only">فیلتر دسته‌بندی</span>
            <select value={category} onChange={event => { setLoading(true); setPage(1); setCategory(event.target.value); }}>
              <option value="">همه دسته‌ها</option>
              {categories.map(group => <optgroup key={group.slug} label={group.title}>
                <option value={group.slug}>{group.title}</option>
                {group.children.map(child => <option key={child.slug} value={child.slug}>↳ {child.title}</option>)}
              </optgroup>)}
            </select>
          </label>
          <label className="admin-inline-field"><span className="sr-only">فیلتر موجودی</span>
            <select value={stock} onChange={event => { setLoading(true); setPage(1); setStock(event.target.value); }}>
              <option value="all">همه موجودی‌ها</option><option value="low">کم‌موجود (۱ تا ۳)</option>
              <option value="out">ناموجود</option>
            </select>
          </label>
        </div>
      </div>
      {error && <div className="admin-panel-body"><Notice tone="error">{error}</Notice></div>}
      {loading && !data ? <div className="admin-panel-body"><Loading label="در حال دریافت محصولات…"/></div>
        : data && data.items.length ? <div aria-busy={loading}>
          <div className="admin-table-scroll">
            <table className="admin-table admin-table-cards admin-product-table">
              <thead><tr>
                <th scope="col">محصول</th><th scope="col">وضعیت</th><th scope="col">موجودی کل</th>
                <th scope="col">قیمت (تومان)</th><th scope="col">مدیریت</th>
              </tr></thead>
              <tbody>
                {data.items.map(product => <Row key={product.id} product={product}
                  permissions={permissions} changed={reload} edit={edit} duplicate={canCreate ? duplicate : undefined}/>)}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} unit="محصول"
            onPage={next => { setLoading(true); setPage(next); }}/>
        </div> : <div className="admin-empty"><PackageSearch size={31} aria-hidden="true"/>
          <p>{filtered ? 'محصولی با این مشخصات پیدا نشد.' : 'هنوز محصولی ثبت نشده است.'}</p>
          {filtered && <button type="button" className="admin-btn admin-btn-outline"
            onClick={() => { setLoading(true); setQuery(''); setSearch(''); setStatus('all'); setStock('all'); setCategory(''); setPage(1); }}>
            حذف فیلترها</button>}
        </div>}
    </section>
  </div>;
}
