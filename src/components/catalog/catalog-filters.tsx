'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, X } from 'lucide-react';
import { categories } from '@/data/products';
import type { CatalogFilters } from '@/types/store';

type Props = { filters: CatalogFilters; action: string; fixedCategory?: boolean; count: number };

export function CatalogFilters({ filters, action, fixedCategory, count }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onDocumentEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('keydown', onDocumentEscape);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onDocumentEscape); };
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const items = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])');
    if (!items?.length) return;
    const first = items[0], last = items[items.length-1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <>
    <div className="catalog-mobile-controls">
      <button type="button" className="btn btn-outline filter-open-button" ref={trigger}
        onClick={() => setOpen(true)} aria-expanded={open} aria-controls="catalog-filter-panel">
        <SlidersHorizontal size={17}/> فیلتر و مرتب‌سازی
      </button>
      <span className="catalog-mobile-count">{count.toLocaleString('fa-IR')} محصول</span>
    </div>
    {open && <button type="button" className="filter-backdrop" aria-label="بستن فیلترها" onClick={close}/>}
    <aside id="catalog-filter-panel" ref={panel} className={'filters-panel'+(open?' is-open':'')}
      role={open?'dialog':undefined} aria-modal={open?true:undefined} aria-label="فیلترهای محصولات" onKeyDown={onKeyDown}>
      <div className="filter-panel-heading">
        <span><SlidersHorizontal size={18}/> فیلترها</span>
        <button type="button" className="icon-button filter-close" ref={closeButton} aria-label="بستن فیلترها" onClick={close}><X size={21}/></button>
      </div>
      <form method="get" action={action} className="filter-form">
        {filters.q && <input type="hidden" name="q" value={filters.q}/>}
        {!fixedCategory && <label>دسته‌بندی
          <select name="category" defaultValue={filters.category ?? ''}><option value="">همه دسته‌ها</option>
            {categories.map(category => <option key={category.slug} value={category.slug}>{category.title}</option>)}</select>
        </label>}
        <label>سایز
          <select name="size" defaultValue={filters.size ?? ''}><option value="">همه سایزها</option>
            {['S','M','L','XL'].map(size => <option key={size} value={size}>{size}</option>)}</select>
        </label>
        <label>رنگ
          <select name="color" defaultValue={filters.color ?? ''}>
            <option value="">همه رنگ‌ها</option><option value="cream">کرم</option><option value="black">مشکی</option>
            <option value="rose">رز خاکی</option><option value="sage">سبز سدری</option>
            <option value="blue">آبی دودی</option><option value="white">سفید</option>
          </select>
        </label>
        <div className="price-fields">
          <label>حداقل قیمت (تومان)<input type="number" inputMode="numeric" name="min" min="0" placeholder="از" defaultValue={filters.min ?? ''}/></label>
          <label>حداکثر قیمت (تومان)<input type="number" inputMode="numeric" name="max" min="0" placeholder="تا" defaultValue={filters.max ?? ''}/></label>
        </div>
        <label>مرتب‌سازی
          <select name="sort" defaultValue={filters.sort ?? 'featured'}>
            <option value="featured">پیشنهادی</option><option value="newest">جدیدترین</option>
            <option value="price-asc">ارزان‌ترین</option><option value="price-desc">گران‌ترین</option>
          </select>
        </label>
        <label className="check-row"><input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock}/> فقط موجودها</label>
        <label className="check-row"><input type="checkbox" name="sale" value="1" defaultChecked={filters.discounted}/> فقط تخفیف‌دارها</label>
        <div className="filter-buttons">
          <button className="btn btn-dark" type="submit">اعمال فیلترها</button>
          <Link href={action} className="btn btn-line" onClick={close}>حذف فیلترها</Link>
        </div>
      </form>
    </aside>
  </>;
}
