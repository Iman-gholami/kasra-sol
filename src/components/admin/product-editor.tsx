'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { adminApi, AdminApiError, errorMessage } from '@/components/admin/admin-api';
import { digitsOnly, formatNumber, PRODUCT_STATUS } from '@/components/admin/labels';
import { Badge, Loading, Notice } from '@/components/admin/ui';
import { categories } from '@/data/facets';
import type { CategorySlug } from '@/types/store';

type Color = { id: string; name: string; hex: string; familyId?: string };
type Variant = { colorId: string; size: string; stock: number };
type CatalogProduct = {
  id: string; slug: string; name: string; category: CategorySlug;
  description: string; price: number; compareAt: number | null; images: string[];
  colors: Color[]; sizes: string[]; variants: Variant[];
  material: string; fit: string; care: string; featured: boolean;
};
type Status = 'active' | 'draft' | 'archived';
type Loaded = { item: CatalogProduct & { status: Status }; revision: string };
const MAX_IMAGES = 8;
const IDENT = /^[a-z0-9][a-z0-9-]{1,78}$/;
export const UNSAVED_CHANGES = 'تغییرات ذخیره‌نشده فرم محصول از بین می‌رود. ادامه می‌دهید؟';
const empty = (): CatalogProduct => ({
  id: '', slug: '', name: '', category: 'womens-clothing', description: '',
  price: 0, compareAt: null, images: [], colors: [{ id: 'black', name: 'مشکی', hex: '#000000' }],
  sizes: ['M'], variants: [{ colorId: 'black', size: 'M', stock: 0 }],
  material: '', fit: '', care: '', featured: false
});
const FIELD_NAMES: Record<string, string> = {
  id: 'شناسه', slug: 'آدرس محصول', name: 'نام', category: 'دسته‌بندی', description: 'توضیحات (حداقل ۱۰ نویسه)',
  price: 'قیمت فروش', compareAt: 'قیمت قبل از تخفیف (باید از قیمت فروش کمتر نباشد)', images: 'تصاویر',
  colors: 'رنگ‌ها', sizes: 'سایزها', variants: 'موجودی رنگ و سایز', material: 'جنس', fit: 'فرم', care: 'نگهداری'
};
const parseSizes = (text: string) => [...new Set(text.split(/[,،]/).map(x => x.trim()).filter(Boolean))];
/** What the API receives: one stock row per color × size, in form order. Also the basis of the unsaved-changes check. */
function payloadOf(item: CatalogProduct, sizeText: string): CatalogProduct {
  const sizes = parseSizes(sizeText);
  return {
    id: item.id, slug: item.slug, name: item.name, category: item.category, description: item.description,
    price: item.price, compareAt: item.compareAt, images: item.images, sizes,
    variants: item.colors.flatMap(c => sizes.map(size => ({
      colorId: c.id, size, stock: item.variants.find(v => v.colorId === c.id && v.size === size)?.stock ?? 0
    }))),
    colors: item.colors.map(({ id, name, hex, familyId }) => ({ id: id.trim(), name: name.trim(), hex, ...(familyId ? { familyId } : {}) })),
    material: item.material, fit: item.fit, care: item.care, featured: item.featured
  };
}
const fingerprint = (item: CatalogProduct, sizeText: string) => JSON.stringify(payloadOf(item, sizeText));

function Field({ title, hint, children, wide }: { title: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return <label className={'admin-field' + (wide ? ' admin-field-wide' : '')}><span>{title}</span>{children}
    {hint && <small>{hint}</small>}</label>;
}

/** Edits `productId`, creates a new draft, or (with `copyOf`) a new draft prefilled from another product. */
export function ProductEditor({ productId, copyOf, permissions, done, onUnsaved }: {
  productId?: string; copyOf?: string; permissions: string[]; done: (saved: boolean) => void;
  onUnsaved?: (question: string | null) => void;
}) {
  const canPrice = permissions.includes('products:price');
  const canStock = permissions.includes('inventory:write');
  const source = productId ?? copyOf;
  const [item, setItem] = useState<CatalogProduct>(empty);
  const [sizeText, setSizeText] = useState('M');
  const [baseline, setBaseline] = useState(() => fingerprint(empty(), 'M'));
  const [status, setStatus] = useState<Status>('draft');
  const [revision, setRevision] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(source));
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const fetchProduct = useCallback(() => adminApi<Loaded>('products/' + source), [source]);
  const apply = useCallback((data: Loaded) => {
    const { status: loaded, ...product } = data.item;
    // A copy is a new product: it gets its own address, starts as a draft, and holds no stock until counted.
    const next: CatalogProduct = copyOf ? {
      ...empty(), ...product, id: (product.id + '-copy').slice(0, 79), slug: (product.slug + '-copy').slice(0, 100),
      name: product.name + ' (کپی)', variants: product.variants.map(v => ({ ...v, stock: 0 }))
    } : { ...empty(), ...product };
    const text = next.sizes.join(', ');
    setItem(next); setSizeText(text); setBaseline(fingerprint(next, text));
    setStatus(copyOf ? 'draft' : loaded);
    setRevision(copyOf ? '' : data.revision);
  }, [copyOf]);
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    fetchProduct().then(data => { if (!cancelled) apply(data); })
      .catch(cause => { if (!cancelled) setError(errorMessage(cause)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [source, fetchProduct, apply]);
  useEffect(() => { if (!loading) heading.current?.focus(); }, [loading]);

  const payload = useMemo(() => payloadOf(item, sizeText), [item, sizeText]);
  const dirty = !loading && JSON.stringify(payload) !== baseline;
  // The dashboard asks before switching sections; the browser asks before closing or reloading the tab.
  useEffect(() => { onUnsaved?.(dirty ? UNSAVED_CHANGES : null); }, [dirty, onUnsaved]);
  useEffect(() => () => onUnsaved?.(null), [onUnsaved]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const leave = () => { if (!dirty || window.confirm(UNSAVED_CHANGES)) done(false); };

  const edit = <K extends keyof CatalogProduct>(key: K, value: CatalogProduct[K]) =>
    setItem(prev => ({ ...prev, [key]: value }));
  const moveImage = (from: number, to: number) => setItem(prev => {
    const images = [...prev.images];
    const [moved] = images.splice(from, 1);
    images.splice(to, 0, moved);
    return { ...prev, images };
  });
  const editColor = (index: number, patch: Partial<Color>) =>
    setItem(prev => ({ ...prev, colors: prev.colors.map((c, j) => j === index ? { ...c, ...patch } : c) }));
  // Stock is stored per color id, so it moves with a renamed color, unless another color shares either id
  // (then it is unclear whose stock it is, and it stays where it was).
  const renameColor = (index: number, id: string) => setItem(prev => {
    const old = prev.colors[index].id;
    if (old === id) return prev;
    const others = prev.colors.filter((_, j) => j !== index).map(c => c.id);
    const carry = !others.includes(old) && !others.includes(id);
    return { ...prev, colors: prev.colors.map((c, j) => j === index ? { ...c, id } : c),
      variants: carry ? prev.variants.filter(v => v.colorId !== id).map(v => v.colorId === old ? { ...v, colorId: id } : v) : prev.variants };
  });
  const removeColor = (index: number) => setItem(prev => {
    const id = prev.colors[index].id;
    const shared = prev.colors.some((c, j) => j !== index && c.id === id);
    return { ...prev, colors: prev.colors.filter((_, j) => j !== index),
      variants: shared ? prev.variants : prev.variants.filter(v => v.colorId !== id) };
  });

  async function upload(files: FileList) {
    setError(''); setMessage('');
    const room = MAX_IMAGES - item.images.length;
    const chosen = [...files].slice(0, Math.max(0, room));
    if (!chosen.length) { setError('برای هر محصول حداکثر ' + formatNumber(MAX_IMAGES) + ' تصویر مجاز است.'); return; }
    const invalid = chosen.find(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024 || file.size === 0);
    if (invalid) { setError('«' + invalid.name + '»: تصویر باید JPG، PNG یا WebP و حداکثر ۲ مگابایت باشد.'); return; }
    setUploading(true);
    try {
      for (const file of chosen) {
        const response = await fetch('/api/admin/media', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
        if (!response.ok || !result.url) throw new AdminApiError(response.status, result.error ?? '', result);
        setItem(prev => ({ ...prev, images: [...prev.images, result.url!].slice(0, MAX_IMAGES) }));
      }
      setMessage(formatNumber(chosen.length) + ' تصویر بارگذاری شد؛ برای اعمال در فروشگاه، محصول را ذخیره کنید.' +
        (files.length > chosen.length ? ' بقیه به‌دلیل سقف ' + formatNumber(MAX_IMAGES) + ' تصویر اضافه نشدند.' : ''));
    } catch (cause) { setError('آپلود تصویر ناموفق بود: ' + errorMessage(cause)); }
    finally { setUploading(false); }
  }

  function validate(): string | null {
    if (!IDENT.test(item.id)) return 'شناسه باید لاتین کوچک، عدد یا خط تیره و حداقل دو نویسه باشد.';
    if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(item.slug)) return 'آدرس محصول (slug) باید لاتین کوچک، عدد یا خط تیره باشد.';
    if (!payload.sizes.length) return 'حداقل یک سایز لازم است.';
    if (!item.colors.length || item.colors.some(c => !IDENT.test(c.id) || !c.name.trim())) return 'شناسه هر رنگ باید لاتین (مثل navy-blue) و نام آن پر باشد.';
    if (new Set(item.colors.map(c => c.id)).size !== item.colors.length) return 'شناسه رنگ‌ها نباید تکراری باشد.';
    if (item.compareAt !== null && item.compareAt < item.price) return 'قیمت قبل از تخفیف نباید از قیمت فروش کمتر باشد.';
    if (status === 'active' && !item.images.length)
      return 'این محصول منتشرشده است و باید دست‌کم یک تصویر داشته باشد؛ برای حذف همه تصاویر، ابتدا آن را از فهرست آرشیو کنید.';
    if (status === 'active' && item.price <= 0) return 'قیمت فروش محصول منتشرشده باید بیشتر از صفر باشد.';
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setMessage(''); setStale(false);
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    try {
      await adminApi('products' + (productId ? '/' + productId : ''), {
        method: productId ? 'PUT' : 'POST', body: payload,
        headers: productId ? { 'If-Match': '"' + revision + '"' } : undefined
      });
      done(true);
    } catch (cause) {
      if (cause instanceof AdminApiError && cause.code === 'product_changed_reload_required') setStale(true);
      const fields = cause instanceof AdminApiError
        ? Object.keys((cause.data.details as { fieldErrors?: Record<string, unknown> } | undefined)?.fieldErrors ?? {}) : [];
      const permission = cause instanceof AdminApiError ? cause.data.permission : undefined;
      setError(errorMessage(cause) + (fields.length ? ' موارد: ' + fields.map(f => FIELD_NAMES[f] ?? f).join('، ') : '') +
        (permission === 'products:price' ? ' (تغییر قیمت نیاز به مجوز قیمت‌گذاری دارد.)' :
          permission === 'inventory:write' ? ' (تغییر موجودی، رنگ یا سایز نیاز به مجوز موجودی دارد.)' : ''));
    } finally { setBusy(false); }
  }
  async function reloadLatest() {
    if (!window.confirm('آخرین نسخه بارگذاری شود؟ تغییرات ذخیره‌نشده این فرم از بین می‌رود.')) return;
    setError(''); setStale(false);
    try { apply(await fetchProduct()); setMessage('آخرین نسخه محصول بارگذاری شد.'); } catch (cause) { setError(errorMessage(cause)); }
  }

  if (loading) return <Loading label="در حال دریافت محصول…"/>;
  const priceLock = !canPrice ? 'نیاز به مجوز «تغییر قیمت»' : undefined;
  const stockLock = !canStock ? 'نیاز به مجوز «تغییر موجودی»' : undefined;
  return <section className="admin-panel" aria-labelledby="editor-title">
    <div className="admin-panel-head">
      <div>
        <h2 id="editor-title" ref={heading} tabIndex={-1}>
          {productId ? 'ویرایش محصول' : copyOf ? 'کپی محصول' : 'افزودن محصول جدید'}
          {productId && <Badge tone={PRODUCT_STATUS[status].tone}>{PRODUCT_STATUS[status].label}</Badge>}
        </h2>
        <p>{productId ? <bdi dir="ltr">{productId}</bdi> : copyOf
          ? <>از روی <bdi dir="ltr">{copyOf}</bdi>؛ موجودی‌ها صفر شده‌اند و نسخه تازه پیش‌نویس ذخیره می‌شود</>
          : 'محصول جدید به‌صورت پیش‌نویس ذخیره می‌شود و بعد از افزودن تصویر قابل انتشار است.'} · مبالغ به تومان</p>
      </div>
      <button type="button" className="admin-btn admin-btn-outline" onClick={leave}>
        <ArrowRight size={15} aria-hidden="true"/> بازگشت به فهرست</button>
    </div>
    <form onSubmit={submit} className="admin-panel-body admin-form" noValidate={false}>
      <fieldset className="admin-fieldset">
        <legend>اطلاعات اصلی</legend>
        <div className="admin-form-grid">
          <Field title="شناسه ثابت (لاتین)" hint={productId ? 'شناسه بعد از ایجاد تغییر نمی‌کند.' : 'مثلاً manto-linen-01'}>
            <input dir="ltr" required disabled={Boolean(productId)} value={item.id} pattern="[a-z0-9][a-z0-9\-]{1,78}"
              onChange={event => edit('id', event.target.value.toLowerCase())}/>
          </Field>
          <Field title="آدرس محصول (slug)" hint="در نشانی صفحه محصول دیده می‌شود.">
            <input dir="ltr" required pattern="[a-z0-9][a-z0-9\-]{1,99}" value={item.slug}
              onChange={event => edit('slug', event.target.value.toLowerCase())}/>
          </Field>
          <Field title="نام محصول">
            <input required minLength={2} maxLength={200} value={item.name} onChange={event => edit('name', event.target.value)}/>
          </Field>
          <Field title="دسته‌بندی" hint="زیرگروه دقیق را انتخاب کنید؛ اگر محصول زیرگروه مشخصی ندارد، دسته اصلی را انتخاب کنید.">
            <select value={item.category} onChange={event => edit('category', event.target.value as CategorySlug)}>
              {categories.map(group => <optgroup key={group.slug} label={group.title}>
                <option value={group.slug}>{group.title}{group.children.length ? ' (عمومی)' : ''}</option>
                {group.children.map(child => <option key={child.slug} value={child.slug}>↳ {child.title}</option>)}
              </optgroup>)}
            </select>
          </Field>
          <Field title="قیمت فروش (تومان)" hint={priceLock ?? (status === 'active' ? undefined : 'برای انتشار، قیمت باید بیشتر از صفر باشد.')}>
            <input type="text" inputMode="numeric" dir="ltr" required disabled={!canPrice} value={String(item.price)}
              onChange={event => edit('price', Number(digitsOnly(event.target.value)) || 0)}/>
          </Field>
          <Field title="قیمت قبل از تخفیف (اختیاری)" hint={priceLock ?? 'اگر پر شود، روی کارت محصول خط می‌خورد.'}>
            <input type="text" inputMode="numeric" dir="ltr" disabled={!canPrice} value={item.compareAt ?? ''}
              onChange={event => {
                const digits = digitsOnly(event.target.value);
                edit('compareAt', digits === '' ? null : Number(digits));
              }}/>
          </Field>
          <Field title="توضیحات محصول" wide>
            <textarea required rows={4} minLength={10} maxLength={4000}
              value={item.description} onChange={event => edit('description', event.target.value)}/>
          </Field>
          {([['material', 'جنس پارچه'], ['fit', 'فرم لباس'], ['care', 'راهنمای نگهداری']] as const)
            .map(([key, label]) => <Field key={key} title={label}>
              <input required value={item[key]} onChange={event => edit(key, event.target.value)}/>
            </Field>)}
          <label className="admin-check">
            <input type="checkbox" checked={item.featured} onChange={event => edit('featured', event.target.checked)}/>
            محصول ویژه (در ترتیب «پیشنهاد ما» جلوتر)
          </label>
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>عکس‌های محصول</legend>
        <p className="admin-hint">JPG، PNG یا WebP، هر کدام حداکثر ۲ مگابایت و حداکثر {formatNumber(MAX_IMAGES)} تصویر. تصویر اول، تصویر اصلی ویترین است.</p>
        <label className={'admin-upload' + (uploading || item.images.length >= MAX_IMAGES ? ' is-disabled' : '')}>
          <ImagePlus size={20} aria-hidden="true"/>
          <span>{uploading ? 'در حال بارگذاری…' : 'انتخاب تصویر (امکان انتخاب چند فایل)'}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only"
            disabled={uploading || item.images.length >= MAX_IMAGES}
            onChange={event => { if (event.target.files?.length) void upload(event.target.files); event.target.value = ''; }}/>
        </label>
        {item.images.length ? <ol className="admin-gallery">
          {item.images.map((src, idx) => <li key={src} className="admin-gallery-item">
            {idx === 0 && <span className="admin-gallery-primary"><Star size={12} aria-hidden="true"/> تصویر اصلی</span>}
            <Image src={src} width={112} height={136} unoptimized alt={'تصویر ' + formatNumber(idx + 1) + ' ' + (item.name || 'محصول')}/>
            <div className="admin-gallery-actions">
              <button type="button" className="admin-icon-btn" disabled={idx === 0} onClick={() => moveImage(idx, idx - 1)}
                aria-label={'انتقال تصویر ' + formatNumber(idx + 1) + ' به جلو'}><ArrowRight size={15} aria-hidden="true"/></button>
              {idx > 0 && <button type="button" className="admin-icon-btn" onClick={() => moveImage(idx, 0)}
                aria-label={'تصویر ' + formatNumber(idx + 1) + ' تصویر اصلی شود'}><Star size={15} aria-hidden="true"/></button>}
              <button type="button" className="admin-icon-btn" disabled={idx === item.images.length - 1}
                onClick={() => moveImage(idx, idx + 1)} aria-label={'انتقال تصویر ' + formatNumber(idx + 1) + ' به عقب'}>
                <ArrowLeft size={15} aria-hidden="true"/></button>
              <button type="button" className="admin-icon-btn admin-icon-danger"
                onClick={() => edit('images', item.images.filter((_, i) => i !== idx))}
                aria-label={'حذف تصویر ' + formatNumber(idx + 1) + ' از محصول'}><Trash2 size={15} aria-hidden="true"/></button>
            </div>
          </li>)}
        </ol> : <Notice tone="warning">{status === 'active'
          ? 'این محصول منتشرشده است و بدون تصویر ذخیره نمی‌شود؛ دست‌کم یک تصویر اضافه کنید.'
          : 'این محصول هنوز تصویری ندارد؛ ذخیره پیش‌نویس ممکن است، اما انتشار بدون تصویر مجاز نیست.'}</Notice>}
      </fieldset>

      <fieldset className="admin-fieldset" disabled={!canStock}>
        <legend>رنگ‌ها و سایزها</legend>
        <p className="admin-hint">شناسه هر رنگ لاتین است (مثلاً navy یا light-blue) و بعد از ثبت سفارش بهتر است تغییر نکند.</p>
        {stockLock && <p className="admin-hint">{stockLock}؛ رنگ، سایز و موجودی فقط نمایش داده می‌شوند.</p>}
        <div className="admin-stack-sm">
          {item.colors.map((color, idx) => <div key={idx} className="admin-color-row">
            <Field title="نام رنگ">
              <input required value={color.name} onChange={event => editColor(idx, { name: event.target.value })}/>
            </Field>
            <Field title="شناسه لاتین">
              <input dir="ltr" required value={color.id} pattern="[a-z0-9][a-z0-9\-]{1,78}"
                onChange={event => renameColor(idx, event.target.value.toLowerCase())}/>
            </Field>
            <Field title="رنگ نمونه">
              <input type="color" value={color.hex} onChange={event => editColor(idx, { hex: event.target.value })}/>
            </Field>
            <button type="button" className="admin-btn admin-btn-danger admin-btn-small" disabled={item.colors.length === 1}
              onClick={() => removeColor(idx)}
              aria-label={'حذف رنگ ' + (color.name || formatNumber(idx + 1))}>حذف رنگ</button>
          </div>)}
          <button className="admin-btn admin-btn-outline admin-btn-small admin-self-start" type="button"
            onClick={() => edit('colors', [...item.colors, { id: 'color-' + (item.colors.length + 1), name: '', hex: '#777777' }])}>
            افزودن رنگ
          </button>
          <Field title="سایزها، جداشده با ویرگول" hint="مثلاً S, M, L یا فری‌سایز">
            <input dir="auto" required value={sizeText} onChange={event => setSizeText(event.target.value)}/>
          </Field>
        </div>
      </fieldset>

      <fieldset className="admin-fieldset" disabled={!canStock}>
        <legend>موجودی هر رنگ و سایز</legend>
        <div className="admin-stock-grid">
          {payload.variants.map(variant => <label key={variant.colorId + '-' + variant.size} className="admin-stock-cell">
            <span>{item.colors.find(c => c.id === variant.colorId)?.name || variant.colorId} / <bdi>{variant.size}</bdi></span>
            <input type="text" inputMode="numeric" maxLength={7} required dir="ltr"
              value={String(variant.stock)} onChange={event => {
                const stock = Math.min(1_000_000, Number(digitsOnly(event.target.value)) || 0);
                setItem(prev => ({ ...prev, variants: [
                  ...prev.variants.filter(v => !(v.colorId === variant.colorId && v.size === variant.size)),
                  { colorId: variant.colorId, size: variant.size, stock }
                ] }));
              }}/>
          </label>)}
        </div>
      </fieldset>

      {error && <Notice tone="error">{error}
        {stale && <button type="button" className="admin-btn admin-btn-outline admin-btn-small admin-notice-action"
          onClick={() => void reloadLatest()}>بارگذاری آخرین نسخه</button>}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <div className="admin-actions admin-sticky-actions">
        <button type="submit" disabled={busy || uploading} className="admin-btn admin-btn-primary">
          {busy ? 'در حال ذخیره…' : productId ? 'ذخیره تغییرات محصول' : 'ایجاد پیش‌نویس محصول'}
        </button>
        <button type="button" onClick={leave} className="admin-btn admin-btn-outline">انصراف</button>
        {dirty && <span className="admin-sub">تغییرات ذخیره‌نشده دارید.</span>}
      </div>
    </form>
  </section>;
}
