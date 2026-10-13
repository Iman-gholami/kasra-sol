'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowDownWideNarrow, SlidersHorizontal, X } from 'lucide-react';
import { categories, palette, standardSizes } from '@/data/facets';
import type { CatalogFilters } from '@/types/store';

type Props = { filters: CatalogFilters; action: string; fixedCategory?: boolean; count: number };


export function CatalogFilters({ filters, action, fixedCategory }: Props) {
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
        onClick={() => setOpen(true)} aria-expanded={open} aria-controls="catalog-filter-panel" aria-label="فیلتر محصولات">
        <SlidersHorizontal size={17}/><span className="filter-mobile-short">فیلتر</span><span className="filter-mobile-full">فیلتر محصولات</span>
      </button>
      <form className="catalog-mobile-sort" method="get" action={action}>
        {filters.q && <input type="hidden" name="q" value={filters.q}/>}
        {filters.category && !fixedCategory && <input type="hidden" name="category" value={filters.category}/>}
        {filters.size && <input type="hidden" name="size" value={filters.size}/>}
        {filters.color && <input type="hidden" name="color" value={filters.color}/>}
        {filters.min !== undefined && <input type="hidden" name="min" value={String(filters.min)}/>}
        {filters.max !== undefined && <input type="hidden" name="max" value={String(filters.max)}/>}
        {filters.inStock && <input type="hidden" name="stock" value="1"/>}
        {filters.discounted && <input type="hidden" name="sale" value="1"/>}
        <ArrowDownWideNarrow size={17} strokeWidth={1.75} aria-hidden="true"/>
        <select name="sort" defaultValue={filters.sort ?? 'featured'} aria-label="مرتب‌سازی محصولات">
          <option value="featured">پیشنهادی</option><option value="newest">تازه‌ترین</option>
          <option value="price-asc">قیمت: کم به زیاد</option><option value="price-desc">قیمت: زیاد به کم</option>
        </select>
        <button type="submit" aria-label="اعمال مرتب‌سازی موبایل">اعمال</button>
      </form>
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
        <input type="hidden" name="sort" value={filters.sort ?? 'featured'}/>
        {!fixedCategory && <label>دسته‌بندی
          <select name="category" defaultValue={filters.category ?? ''}><option value="">همه دسته‌ها</option>
            {categories.map(category => <option key={category.slug} value={category.slug}>{category.title}</option>)}</select>
        </label>}
        <label>سایز
          <select name="size" defaultValue={filters.size ?? ''}><option value="">همه سایزها</option>
            {standardSizes.map(size => <option key={size} value={size}>{size}</option>)}</select>
        </label>
        <fieldset className="filter-color-fieldset">
          <legend>رنگ</legend>
          <div className="filter-color-grid">
            <label className="filter-color-choice filter-any">
              <input type="radio" name="color" value="" defaultChecked={!filters.color}/>
              <span className="filter-color-dot filter-color-any" aria-hidden="true">×</span><span>همه</span>
            </label>
            {palette.map(color => <label key={color.id} className="filter-color-choice">
              <input type="radio" name="color" value={color.id} defaultChecked={filters.color===color.id}/>
              <span className="filter-color-dot" style={{backgroundColor:color.hex}} aria-hidden="true"/>
              <span>{color.name}</span>
            </label>)}
          </div>
        </fieldset>
        <div className="price-fields">
          <label>حداقل قیمت (تومان)<input type="number" inputMode="numeric" name="min" min="0" placeholder="از" defaultValue={filters.min ?? ''}/></label>
          <label>حداکثر قیمت (تومان)<input type="number" inputMode="numeric" name="max" min="0" placeholder="تا" defaultValue={filters.max ?? ''}/></label>
        </div>
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
