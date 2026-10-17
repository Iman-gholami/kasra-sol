'use client';

import { Fragment, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Archive, ChevronDown, ChevronUp, ImageIcon, PackageSearch, Pencil, Plus, Search, Send, SlidersHorizontal } from 'lucide-react';

export type ProductRow = {
  id: string; name: string; slug: string; category: string;
  price: number; stock: number; active: boolean; images?: string[];
};
type Variant = { id: string; color_id: string; size: string; stock: number };
const money = (amount: number) => new Intl.NumberFormat('fa-IR').format(amount);
const number = (amount: number) => new Intl.NumberFormat('fa-IR').format(amount);
const categoryNames: Record<string, string> = { manto: 'مانتو', shomiz: 'شومیز', tshirt: 'تیشرت' };
async function call<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api/admin/' + path, {
    method, cache: 'no-store', headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined
  });
  if (!response.ok) throw new Error(response.status === 403 ? 'مجوز انجام این عملیات را ندارید.' :
    'عملیات ناموفق بود (کد ' + response.status + ').');
  return response.json() as Promise<T>;
}
function Row({ product, permissions, refreshed, edit }: {
  product: ProductRow; permissions: string[]; refreshed: () => void; edit: (id: string) => void;
}) {
  const [price, setPrice] = useState(product.price);
  const [expanded, setExpanded] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const can = (permission: string) => permissions.includes(permission);
  const canEditFull = can('products:write') && can('products:price') && can('inventory:write');

  async function savePrice(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice('');
    try {
      await call('products/' + product.id + '/price', 'PATCH', { price });
      setNotice('قیمت ذخیره شد.'); refreshed();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'خطای ذخیره قیمت'); }
    finally { setBusy(false); }
  }
  async function visibility() {
    if (!window.confirm(product.active ? 'محصول از ویترین پنهان شود؟ اطلاعات سفارش‌ها حفظ می‌شود.' :
      'محصول در فروشگاه منتشر شود؟')) return;
    setBusy(true); setNotice('');
    try {
      await call('products/' + product.id + '/visibility', 'PATCH', { active: !product.active });
      refreshed();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'خطای تغییر انتشار'); }
    finally { setBusy(false); }
  }
  async function toggleVariants() {
    if (expanded) { setExpanded(false); return; }
    setBusy(true); setNotice('');
    try {
      const result = await call<{ items: Variant[] }>('products/' + product.id + '/variants');
      setVariants(result.items); setStocks(Object.fromEntries(result.items.map(v => [v.id,v.stock])));
      setExpanded(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'خطای دریافت موجودی'); }
    finally { setBusy(false); }
  }
  async function saveStock(id: string) {
    setBusy(true); setNotice('');
    try {
      const stock = stocks[id];
      await call('variants/' + id + '/stock', 'PATCH', { stock });
      setVariants(old => old.map(v => v.id === id ? { ...v, stock } : v));
      setNotice('موجودی ذخیره شد.'); refreshed();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'خطای ذخیره موجودی'); }
    finally { setBusy(false); }
  }
  return <Fragment>
    <tr className={expanded ? 'admin-row-expanded' : undefined}>
      <td>
        <div className="admin-product-title">
          <span className="admin-product-image">
            {product.images?.[0] ? <Image src={product.images[0]} alt="" width={54} height={62}
              unoptimized className="h-full w-full object-cover"/> : <ImageIcon size={22} aria-hidden="true"/>}
          </span>
          <div className="min-w-0">
            <div className="admin-product-name">{product.name}</div>
            <div className="admin-product-sub">{product.id}</div>
            <div className="text-xs text-slate-500">{categoryNames[product.category] ?? product.category}</div>
          </div>
        </div>
      </td>
      <td><span className="admin-status" data-active={product.active}>
        <span aria-hidden="true">●</span>{product.active ? 'منتشرشده' : 'پیش‌نویس / آرشیو'}
      </span></td>
      <td><span className={product.stock <= 0 ? 'admin-stock-none' : product.stock <= 3 ? 'admin-stock-low' : 'admin-stock-good'}>
        {number(product.stock)} عدد
      </span></td>
      <td>
        {can('products:price') ? <form className="admin-price-form" onSubmit={savePrice}>
          <input type="number" min="0" max="1000000000" required dir="ltr" value={price}
            aria-label={'قیمت ' + product.name} onChange={event => setPrice(Number(event.target.value))}/>
          <button className="admin-btn admin-btn-primary admin-btn-small" disabled={busy} type="submit">ثبت</button>
        </form> : <span className="whitespace-nowrap font-bold">{money(product.price)} تومان</span>}
      </td>
      <td>
        <div className="admin-table-actions">
          {canEditFull && <button className="admin-btn admin-btn-outline admin-btn-small" onClick={() => edit(product.id)}
            type="button"><Pencil size={13} aria-hidden="true"/> ویرایش</button>}
          {can('inventory:read') && <button type="button" disabled={busy}
            aria-expanded={expanded} aria-label={'موجودی رنگ و سایز ' + product.name}
            className="admin-btn admin-btn-outline admin-btn-small" onClick={() => void toggleVariants()}>
            {expanded ? <ChevronUp size={14} aria-hidden="true"/> : <ChevronDown size={14} aria-hidden="true"/>}
            موجودی</button>}
          {can('products:write') && <button type="button" disabled={busy}
            className={'admin-btn admin-btn-small ' + (product.active ? 'admin-btn-danger' : 'admin-btn-outline')}
            onClick={() => void visibility()}>
            {product.active ? <Archive size={13} aria-hidden="true"/> : <Send size={13} aria-hidden="true"/>}
            {product.active ? 'آرشیو' : 'انتشار'}</button>}
        </div>
        {notice && <p role="status" className="mt-2 text-xs text-teal-700">{notice}</p>}
      </td>
    </tr>
    {expanded && <tr><td colSpan={5} className="!p-0">
      <div className="admin-variant-detail">
        <h4 className="text-sm font-bold text-teal-950">موجودی رنگ‌ها و سایزهای {product.name}</h4>
        <div className="admin-variant-grid">
          {variants.map(variant => <div key={variant.id} className="admin-variant-card">
            <span>{variant.color_id} / {variant.size} <small className="text-slate-500">({number(variant.stock)} عدد)</small></span>
            {can('inventory:write') && <div className="flex gap-2 items-center">
              <input type="number" min="0" max="1000000" dir="ltr" aria-label={'موجودی ' + variant.color_id + ' ' + variant.size}
                value={stocks[variant.id] ?? variant.stock}
                onChange={event => setStocks(s => ({ ...s, [variant.id]: Number(event.target.value) }))}/>
              <button type="button" disabled={busy} className="admin-btn admin-btn-primary admin-btn-small"
                onClick={() => void saveStock(variant.id)}>ثبت</button>
            </div>}
          </div>)}
          {!variants.length && <p className="text-xs text-slate-600">تنوعی تعریف نشده است.</p>}
        </div>
      </div>
    </td></tr>}
  </Fragment>;
}

export function ProductList({ products, permissions, refreshed, edit, create }: {
  products: ProductRow[]; permissions: string[]; refreshed: () => void;
  edit: (id: string) => void; create: () => void;
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'all' | 'active' | 'archived'>('all');
  const [count, setCount] = useState(12);
  const visible = useMemo(() => products.filter(product => {
    const matchName = !query || (product.name + ' ' + product.id + ' ' + product.slug)
      .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matchName && (state === 'all' || (state === 'active' ? product.active : !product.active));
  }), [products, query, state]);
  const canCreate = ['products:write', 'products:price', 'inventory:write'].every(p => permissions.includes(p));
  return <div className="grid gap-5">
    <div className="admin-toolbar">
      <div>
        <h2 className="admin-toolbar-heading">مدیریت محصولات</h2>
        <p className="admin-toolbar-desc">قیمت‌گذاری، موجودی رنگ و سایز، و انتشار محصولات فروشگاه</p>
      </div>
      {canCreate && <button type="button" onClick={create} className="admin-btn admin-btn-primary">
        <Plus size={17} aria-hidden="true"/> افزودن محصول
      </button>}
    </div>
    <section className="admin-section-panel" aria-label="فهرست محصولات">
      <div className="admin-panel-head">
        <div>
          <h3>فهرست محصولات <span className="mr-1 font-normal text-slate-400">({number(visible.length)})</span></h3>
          <p>از این قسمت می‌توانید کالاها را جست‌وجو و مدیریت کنید.</p>
        </div>
        <div className="admin-toolbar-controls">
          <label className="relative block">
            <span className="sr-only">جست‌وجوی محصول</span>
            <Search size={17} aria-hidden="true" className="absolute right-3 top-3 text-slate-400"/>
            <input className="admin-search !pr-10" placeholder="جست‌وجوی نام یا کد محصول…"
              value={query} onChange={event => { setQuery(event.target.value); setCount(12); }}/>
          </label>
          <label className="flex items-center gap-2">
            <SlidersHorizontal size={16} aria-hidden="true" className="text-slate-400"/>
            <span className="sr-only">فیلتر وضعیت انتشار</span>
            <select value={state} onChange={event => { setState(event.target.value as typeof state); setCount(12); }}>
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">منتشرشده</option>
              <option value="archived">پیش‌نویس / آرشیو</option>
            </select>
          </label>
        </div>
      </div>
      {visible.length ? <>
        <div className="admin-table-scroll">
          <table className="admin-product-table">
            <thead><tr>
              <th scope="col">محصول</th><th scope="col">وضعیت</th><th scope="col">موجودی کل</th>
              <th scope="col">قیمت (تومان)</th><th scope="col">مدیریت</th>
            </tr></thead>
            <tbody>
              {visible.slice(0, count).map(product => <Row key={product.id} product={product}
                permissions={permissions} refreshed={refreshed} edit={edit}/>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-500">نمایش {number(Math.min(count, visible.length))} از {number(visible.length)} محصول</p>
          {count < visible.length && <button type="button" className="admin-btn admin-btn-outline"
            onClick={() => setCount(n => n + 12)}>نمایش ۱۲ محصول دیگر <ChevronDown size={15} aria-hidden="true"/></button>}
        </div>
      </> : <div className="admin-empty"><PackageSearch size={31} aria-hidden="true"/>
        <p>محصولی با این مشخصات پیدا نشد.</p>
        <button type="button" className="admin-btn admin-btn-outline mt-3"
          onClick={() => { setQuery(''); setState('all'); }}>حذف فیلترها</button>
      </div>}
    </section>
  </div>;
}
