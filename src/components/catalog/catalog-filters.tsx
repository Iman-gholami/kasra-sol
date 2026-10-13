'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { ArrowDownWideNarrow, SlidersHorizontal, X } from 'lucide-react';
import { categories, palette, standardSizes } from '@/data/facets';
import { toLatinDigits } from '@/lib/format';
import type { CatalogFilters } from '@/types/store';

type Props = { filters: CatalogFilters; action: string; fixedCategory?: boolean; count: number };


export function CatalogFilters({ filters, action, fixedCategory, count }: Props) {
  const activeCount = Number(Boolean(filters.category && !fixedCategory)) + Number(Boolean(filters.size)) +
    Number(Boolean(filters.color)) + Number(filters.min !== undefined) +
    Number(filters.max !== undefined) + Number(Boolean(filters.inStock)) + Number(Boolean(filters.discounted));
  const clearHref = action + (filters.q ? '?q=' + encodeURIComponent(filters.q) : '');
  const [open, setOpen] = useState(false);
  const [priceError, setPriceError] = useState('');
  const minInput = useRef<HTMLInputElement>(null);
  const maxInput = useRef<HTMLInputElement>(null);
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
    setPriceError('');
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

  function validatePrice(event: import('react').FormEvent<HTMLFormElement>) {
    const valueOf = (input: HTMLInputElement | null) => {
      const raw = toLatinDigits(input?.value ?? '').replace(/[\s,٬،]/g, '');
      return raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
    };
    const min = valueOf(minInput.current);
    const max = valueOf(maxInput.current);
    if (min !== undefined && max !== undefined && min > max) {
      event.preventDefault();
      setPriceError('حداقل قیمت نباید بیشتر از حداکثر قیمت باشد.');
      minInput.current?.focus();
      return;
    }
    // Submit normalized Latin digits in URLs; retain native GET routing and link sharing.
    for (const input of [minInput.current, maxInput.current]) {
      if (input && input.value.trim()) {
        input.value = toLatinDigits(input.value).replace(/[\s,٬،]/g, '');
      }
    }
    setPriceError('');
  }

  return <>
    <div className="catalog-mobile-controls">
      <button type="button" className="btn btn-outline filter-open-button" ref={trigger}
        onClick={() => setOpen(true)} aria-expanded={open} aria-controls="catalog-filter-panel" aria-label="فیلتر محصولات">
        <SlidersHorizontal size={17}/><span className="filter-mobile-short">فیلتر</span><span className="filter-mobile-full">فیلتر محصولات</span>
        {activeCount > 0 && <span className="filter-active-count" aria-hidden="true">{activeCount.toLocaleString('fa-IR')}</span>}
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
      <span className="catalog-mobile-result-count">{count.toLocaleString('fa-IR')} کالا</span>
    </div>
    {open && <button type="button" className="filter-backdrop" aria-label="بستن فیلترها" onClick={close}/>}
    <aside id="catalog-filter-panel" ref={panel} className={'filters-panel'+(open?' is-open':'')}
      role={open?'dialog':undefined} aria-modal={open?true:undefined} aria-label="فیلترهای محصولات" onKeyDown={onKeyDown}>
      <div className="filter-panel-heading">
        <span><SlidersHorizontal size={18}/> فیلتر محصولات {activeCount > 0 && <small>({activeCount.toLocaleString('fa-IR')} فعال)</small>}</span>
        <button type="button" className="icon-button filter-close" ref={closeButton} aria-label="بستن فیلترها" onClick={close}><X size={21}/></button>
      </div>
      <form method="get" action={action} className="filter-form" onSubmit={validatePrice}>
        {filters.q && <input type="hidden" name="q" value={filters.q}/>}
        <input type="hidden" name="sort" value={filters.sort ?? 'featured'}/>
        {!fixedCategory && <label>دسته‌بندی
          <select name="category" defaultValue={filters.category ?? ''}><option value="">همه دسته‌ها</option>
            {categories.map(category => <option key={category.slug} value={category.slug}>{category.title}</option>)}</select>
        </label>}
        <fieldset className="filter-size-fieldset">
          <legend>سایز</legend>
          <div className="filter-size-options" dir="ltr">
            <label><input type="radio" name="size" value="" defaultChecked={!filters.size}/><span>همه</span></label>
            {standardSizes.map(size => <label key={size}>
              <input type="radio" name="size" value={size} defaultChecked={filters.size === size}/><span>{size}</span>
            </label>)}
          </div>
        </fieldset>
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
          <label>حداقل قیمت (تومان)<input type="text" inputMode="numeric" ref={minInput} name="min" pattern="[0-9۰-۹٠-٩,٬، ]*" placeholder="مثلاً ۵۰۰٬۰۰۰" defaultValue={filters.min ?? ''}/></label>
          <label>حداکثر قیمت (تومان)<input type="text" inputMode="numeric" ref={maxInput} name="max" pattern="[0-9۰-۹٠-٩,٬، ]*" placeholder="مثلاً ۱٬۰۰۰٬۰۰۰" defaultValue={filters.max ?? ''}/></label>
        </div>
        {priceError && <p className="filter-price-error" role="alert">{priceError}</p>}
        <label className="check-row"><input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock}/> فقط موجودها</label>
        <label className="check-row"><input type="checkbox" name="sale" value="1" defaultChecked={filters.discounted}/> فقط تخفیف‌دارها</label>
        <div className="filter-buttons">
          <button className="btn btn-dark" type="submit">اعمال فیلترها</button>
          <Link href={clearHref} className="btn btn-line" onClick={close}>حذف فیلترها</Link>
        </div>
      </form>
    </aside>
  </>;
}
