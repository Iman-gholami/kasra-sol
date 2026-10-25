'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowDownWideNarrow, Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { categories, palette, standardSizes } from '@/data/facets';
import { formatNumber, toLatinDigits } from '@/lib/format';
import { catalogHref, sortLabels } from '@/lib/catalog-url';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { useCatalogNavigation } from '@/components/catalog/catalog-shell';
import type { CatalogFilters as Filters, CategorySlug } from '@/types/store';

type Props = { filters: Filters; action: string; fixedCategory?: boolean; count: number };
type Draft = { category: string; size: string; color: string; min: string; max: string; stock: boolean; sale: boolean };
type Discrete = Exclude<keyof Draft, 'min' | 'max'>;

const toDraft = (f: Filters): Draft => ({
  category: f.category ?? '', size: f.size ?? '', color: f.color ?? '',
  min: f.min !== undefined ? formatNumber(f.min) : '', max: f.max !== undefined ? formatNumber(f.max) : '',
  stock: Boolean(f.inStock), sale: Boolean(f.discounted)
});
const amount = (value: string) => toLatinDigits(value).replace(/[\s,٬،]/g, '');
const validAmount = (value: string) => !value || (/^\d+$/.test(value) && Number.isSafeInteger(Number(value)));

function fromDraft(base: Filters, draft: Draft, fixedCategory?: boolean): Filters {
  const min = amount(draft.min), max = amount(draft.max);
  return {
    ...base,
    category: fixedCategory ? base.category : (draft.category || undefined) as CategorySlug | undefined,
    size: draft.size || undefined, color: draft.color || undefined,
    min: min ? Number(min) : undefined, max: max ? Number(max) : undefined,
    inStock: draft.stock, discounted: draft.sale, page: undefined
  };
}

/** Filters: a sticky sidebar on desktop and a bottom sheet on ≤ 820px, sharing one draft.
 * Discrete choices apply immediately through client navigation (same URL contract, a history entry
 * per change so Back undoes a filter). Price applies on Enter or the apply button, after validation.
 * Inside the sheet, changes apply behind it so the footer can show the real result count. */
export function CatalogFilters({ filters, action, fixedCategory, count }: Props) {
  const { navigate, pending } = useCatalogNavigation();
  const urlHref = catalogHref(action, filters, fixedCategory);
  const [draft, setDraft] = useState<Draft>(() => toDraft(filters));
  const [seenHref, setSeenHref] = useState(urlHref);
  const [requested, setRequested] = useState<string | null>(null);
  const [priceError, setPriceError] = useState('');
  const [open, setOpen] = useState(false);
  const [sheetPushed, setSheetPushed] = useState(false);
  const mounted = useMountedOnce(open);
  const trigger = useRef<HTMLButtonElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const [showFloating, setShowFloating] = useState(false);

  // Keep the draft in step with the URL: our own navigations land on `requested`; anything else
  // (active-filter chips, Back/Forward, clear-all) resets the draft to what the URL says.
  if (seenHref !== urlHref) {
    setSeenHref(urlHref);
    if (requested === null || requested === urlHref) { setDraft(toDraft(filters)); setRequested(null); }
  } else if (!pending && requested !== null && requested !== urlHref) {
    setRequested(null);
    setDraft(toDraft(filters));
  }

  useEffect(() => {
    const node = controls.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setShowFloating(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const activeCount = Number(Boolean(filters.category && !fixedCategory)) + Number(Boolean(filters.size)) +
    Number(Boolean(filters.color)) + Number(filters.min !== undefined) + Number(filters.max !== undefined) +
    Number(Boolean(filters.inStock)) + Number(Boolean(filters.discounted));
  const clearHref = action + (filters.q ? '?q=' + encodeURIComponent(filters.q) : '');

  function go(href: string, mode: 'push' | 'replace') {
    setRequested(href);
    if (href !== window.location.pathname + window.location.search) navigate(href, mode);
  }

  function change<K extends Discrete>(key: K, value: Draft[K]) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    // Live changes use the applied price from the URL, never an unvalidated price draft.
    const applied = toDraft(filters);
    const href = catalogHref(action, fromDraft(filters, { ...next, min: applied.min, max: applied.max }, fixedCategory), fixedCategory);
    const mode = open && sheetPushed ? 'replace' : 'push';
    if (open) setSheetPushed(true);
    go(href, mode);
  }

  function submit(event: FormEvent<HTMLFormElement>, form: 'sidebar' | 'sheet') {
    event.preventDefault();
    const scope = event.currentTarget;
    const min = amount(draft.min), max = amount(draft.max);
    if (!validAmount(min) || !validAmount(max)) {
      setPriceError('برای قیمت فقط عدد وارد کن؛ مثلاً ۵۰۰٬۰۰۰.');
      scope.querySelector<HTMLInputElement>(validAmount(min) ? 'input[name="max"]' : 'input[name="min"]')?.focus();
      return;
    }
    if (min && max && Number(min) > Number(max)) {
      setPriceError('حداقل قیمت نباید بیشتر از حداکثر قیمت باشد.');
      scope.querySelector<HTMLInputElement>('input[name="min"]')?.focus();
      return;
    }
    setPriceError('');
    go(catalogHref(action, fromDraft(filters, draft, fixedCategory), fixedCategory), form === 'sheet' && sheetPushed ? 'replace' : 'push');
    if (form === 'sheet') closeSheet();
  }

  function openSheet() { setSheetPushed(false); setOpen(true); }
  function closeSheet() { setOpen(false); setPriceError(''); }

  const formProps = { draft, setDraft, change, fixedCategory, filters, priceError, clearPriceError: () => setPriceError('') };

  return <>
    <div className="catalog-mobile-controls" ref={controls}>
      <button type="button" className="btn btn-tertiary filter-open-button" ref={trigger} onClick={openSheet}
        aria-expanded={open} aria-controls="catalog-filter-sheet" aria-label="فیلتر محصولات">
        <SlidersHorizontal size={18} aria-hidden="true"/><span>فیلتر</span>
        {activeCount > 0 && <span className="filter-active-count" aria-hidden="true">{formatNumber(activeCount)}</span>}
      </button>
      <SortSheet action={action} filters={filters} fixedCategory={fixedCategory}/>
    </div>
    <button type="button" className="filter-floating" hidden={!showFloating || open} onClick={openSheet}>
      <SlidersHorizontal size={18} aria-hidden="true"/> فیلترها
      {activeCount > 0 && <span className="filter-active-count">{formatNumber(activeCount)}</span>}
    </button>

    <aside className="filters-panel" aria-labelledby="filters-title">
      <div className="filter-panel-heading">
        <h2 id="filters-title"><SlidersHorizontal size={18} aria-hidden="true"/> فیلتر محصولات</h2>
        {activeCount > 0 && <Link href={clearHref} className="link-button">پاک کردن همه</Link>}
      </div>
      <FilterForm id="sidebar-filters" action={action} onSubmit={event => submit(event, 'sidebar')} {...formProps}>
        <button className="btn btn-primary btn-block" type="submit">اعمال فیلترها</button>
      </FilterForm>
    </aside>

    {mounted && <Sheet open={open} onClose={closeSheet} id="catalog-filter-sheet" label="فیلترهای محصولات"
      className="sheet-bottom filter-sheet" swipe="down" returnFocus={() => trigger.current}>
      <div className="sheet-inner">
        <div className="sheet-header" data-sheet-drag>
          <span className="sheet-handle" aria-hidden="true"/>
          <h2 className="sheet-title">فیلتر محصولات {activeCount > 0 && <small>({formatNumber(activeCount)} فعال)</small>}</h2>
          <button type="button" className="icon-button" aria-label="بستن فیلترها" onClick={closeSheet}><X size={22} aria-hidden="true"/></button>
        </div>
        <div className="sheet-body">
          <FilterForm id="sheet-filters" action={action} onSubmit={event => submit(event, 'sheet')} {...formProps}/>
        </div>
        <div className="sheet-footer filter-sheet-footer">
          <button className="btn btn-primary btn-block" type="submit" form="sheet-filters" data-pending={pending || undefined}>
            <span className="sr-only">اعمال فیلترها و </span>
            {pending ? 'در حال به‌روزرسانی…' : 'نمایش ' + formatNumber(count) + ' کالا'}
          </button>
          <Link href={clearHref} className="btn btn-ghost" onClick={closeSheet}>پاک کردن همه فیلترها</Link>
        </div>
      </div>
    </Sheet>}
  </>;
}

type FormProps = {
  id: string; action: string; draft: Draft; filters: Filters; fixedCategory?: boolean; priceError: string;
  setDraft: (draft: Draft) => void; change: <K extends Discrete>(key: K, value: Draft[K]) => void;
  clearPriceError: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children?: React.ReactNode;
};

function FilterForm({ id, action, draft, filters, fixedCategory, priceError, setDraft, change, clearPriceError, onSubmit, children }: FormProps) {
  const uid = useId();
  const errorId = uid + '-price-error';
  return <form id={id} method="get" action={action} className="filter-form" onSubmit={onSubmit} noValidate>
    {filters.q && <input type="hidden" name="q" value={filters.q}/>}
    {filters.sort && filters.sort !== 'featured' && <input type="hidden" name="sort" value={filters.sort}/>}
    {!fixedCategory && <div className="field">
      <label className="field-label" htmlFor={uid + '-category'}>دسته‌بندی</label>
      <select id={uid + '-category'} name="category" className="control" value={draft.category}
        onChange={event => change('category', event.target.value)}>
        <option value="">همه دسته‌ها</option>
        {categories.map(group => <optgroup key={group.slug} label={group.title}>
          <option value={group.slug}>{group.title}</option>
          {group.children.map(child => <option key={child.slug} value={child.slug}>↳ {child.title}</option>)}
        </optgroup>)}
      </select>
    </div>}
    <fieldset className="filter-fieldset">
      <legend>سایز</legend>
      <div className="filter-size-options" dir="ltr">
        {['', ...standardSizes].map(size => <label key={size || 'all'} className="chip filter-chip">
          <input type="radio" name="size" value={size} checked={draft.size === size} onChange={() => change('size', size)}/>
          <span dir={size ? 'ltr' : 'rtl'}>{size || 'همه'}</span>
        </label>)}
      </div>
    </fieldset>
    <fieldset className="filter-fieldset">
      <legend>رنگ</legend>
      <div className="filter-color-grid">
        <label className="filter-color-choice">
          <input type="radio" name="color" value="" checked={!draft.color} onChange={() => change('color', '')}/>
          <span className="filter-color-dot filter-color-any" aria-hidden="true"/>
          <span>همه</span>
        </label>
        {palette.map(color => <label key={color.id} className="filter-color-choice">
          <input type="radio" name="color" value={color.id} checked={draft.color === color.id} onChange={() => change('color', color.id)}/>
          <span className="filter-color-dot" style={{ backgroundColor: color.hex }} aria-hidden="true"><Check size={14} aria-hidden="true"/></span>
          <span>{color.name}</span>
        </label>)}
      </div>
    </fieldset>
    <fieldset className="filter-fieldset">
      <legend>محدوده قیمت <span className="field-hint-inline">(تومان)</span></legend>
      <div className="price-fields">
        <div className="field">
          <label className="field-label" htmlFor={uid + '-min'}>از</label>
          <input id={uid + '-min'} className="control control-ltr" type="text" inputMode="numeric" enterKeyHint="search" name="min"
            placeholder="۵۰۰٬۰۰۰" value={draft.min} autoComplete="off" aria-invalid={Boolean(priceError) || undefined}
            aria-describedby={priceError ? errorId : undefined}
            onChange={event => { setDraft({ ...draft, min: event.target.value }); clearPriceError(); }}/>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={uid + '-max'}>تا</label>
          <input id={uid + '-max'} className="control control-ltr" type="text" inputMode="numeric" enterKeyHint="search" name="max"
            placeholder="۲٬۰۰۰٬۰۰۰" value={draft.max} autoComplete="off" aria-invalid={Boolean(priceError) || undefined}
            aria-describedby={priceError ? errorId : undefined}
            onChange={event => { setDraft({ ...draft, max: event.target.value }); clearPriceError(); }}/>
        </div>
      </div>
      {priceError && <p className="field-error filter-price-error" id={errorId} role="alert">{priceError}</p>}
    </fieldset>
    <fieldset className="filter-fieldset filter-toggles">
      <legend className="sr-only">وضعیت کالا</legend>
      <label className="check-row"><input type="checkbox" name="stock" value="1" checked={draft.stock} onChange={event => change('stock', event.target.checked)}/> فقط کالاهای موجود</label>
      <label className="check-row"><input type="checkbox" name="sale" value="1" checked={draft.sale} onChange={event => change('sale', event.target.checked)}/> فقط تخفیف‌دارها</label>
    </fieldset>
    {children}
  </form>;
}

/** Desktop sort keeps an explicit apply button (WCAG 3.2.2: changing a select does not navigate by itself). */
export function SortForm({ action, filters, fixedCategory }: { action: string; filters: Filters; fixedCategory?: boolean }) {
  const { navigate } = useCatalogNavigation();
  const uid = useId();
  return <form className="catalog-sort-form" method="get" action={action}
    onSubmit={event => {
      event.preventDefault();
      const value = new FormData(event.currentTarget).get('sort');
      const sort = (typeof value === 'string' ? value : 'featured') as Filters['sort'];
      navigate(catalogHref(action, { ...filters, sort, page: undefined }, fixedCategory));
    }}>
    {filters.q && <input type="hidden" name="q" value={filters.q}/>}
    {filters.category && !fixedCategory && <input type="hidden" name="category" value={filters.category}/>}
    {filters.size && <input type="hidden" name="size" value={filters.size}/>}
    {filters.color && <input type="hidden" name="color" value={filters.color}/>}
    {filters.min !== undefined && <input type="hidden" name="min" value={String(filters.min)}/>}
    {filters.max !== undefined && <input type="hidden" name="max" value={String(filters.max)}/>}
    {filters.inStock && <input type="hidden" name="stock" value="1"/>}
    {filters.discounted && <input type="hidden" name="sale" value="1"/>}
    <label htmlFor={uid}>مرتب‌سازی</label>
    <select id={uid} name="sort" className="control" defaultValue={filters.sort ?? 'featured'} key={filters.sort ?? 'featured'}>
      {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <button type="submit" className="btn btn-secondary btn-sm">اعمال</button>
  </form>;
}

type SortKey = keyof typeof sortLabels;

/** Phones: one button, showing the current order, opens a sheet of sort links; picking one applies it and closes the
 * sheet, two taps instead of select, choose, apply. The options are links to the sorted URLs and act only when
 * activated, like any link, so moving through them changes nothing (WCAG 3.2.2). */
function SortSheet({ action, filters, fixedCategory }: { action: string; filters: Filters; fixedCategory?: boolean }) {
  const { navigate } = useCatalogNavigation();
  const [open, setOpen] = useState(false);
  const mounted = useMountedOnce(open);
  const trigger = useRef<HTMLButtonElement>(null);
  const current: SortKey = filters.sort ?? 'featured';
  return <>
    <button type="button" className="btn btn-tertiary catalog-sort-open" ref={trigger} onClick={() => setOpen(true)}
      aria-expanded={open} aria-controls="catalog-sort-sheet" aria-label={'مرتب‌سازی: ' + sortLabels[current]}>
      <ArrowDownWideNarrow size={18} aria-hidden="true"/><span>{sortLabels[current]}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    {mounted && <Sheet open={open} onClose={() => setOpen(false)} id="catalog-sort-sheet" labelledBy="catalog-sort-title"
      className="sheet-bottom sort-sheet" swipe="down" returnFocus={() => trigger.current}>
      <div className="sheet-inner">
        <div className="sheet-header" data-sheet-drag>
          <span className="sheet-handle" aria-hidden="true"/>
          <h2 className="sheet-title" id="catalog-sort-title">مرتب‌سازی</h2>
          <button type="button" className="icon-button" aria-label="بستن مرتب‌سازی" onClick={() => setOpen(false)}><X size={22} aria-hidden="true"/></button>
        </div>
        <ul className="sheet-body sort-options">
          {(Object.keys(sortLabels) as SortKey[]).map(value => {
            const href = catalogHref(action, { ...filters, sort: value, page: undefined }, fixedCategory);
            const selected = value === current;
            return <li key={value}>
              <Link href={href} className="sort-option" aria-current={selected || undefined} data-autofocus={selected || undefined}
                onClick={event => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  setOpen(false);
                  if (!selected) navigate(href);
                }}>
                {sortLabels[value]}{selected && <Check size={18} aria-hidden="true"/>}
              </Link>
            </li>;
          })}
        </ul>
      </div>
    </Sheet>}
  </>;
}
