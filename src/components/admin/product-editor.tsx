'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { adminApi, AdminApiError, errorMessage } from '@/components/admin/admin-api';
import { formatNumber } from '@/components/admin/labels';
import { Loading, Notice } from '@/components/admin/ui';

type Color = { id: string; name: string; hex: string; familyId?: string };
type Variant = { colorId: string; size: string; stock: number };
type CatalogProduct = {
  id: string; slug: string; name: string; category: 'shomiz' | 'manto' | 'tshirt';
  description: string; price: number; compareAt: number | null; images: string[];
  colors: Color[]; sizes: string[]; variants: Variant[];
  material: string; fit: string; care: string; featured: boolean;
};
const MAX_IMAGES = 8;
const IDENT = /^[a-z0-9][a-z0-9-]{1,78}$/;
const empty = (): CatalogProduct => ({
  id: '', slug: '', name: '', category: 'shomiz', description: '',
  price: 0, compareAt: null, images: [], colors: [{ id: 'black', name: 'مشکی', hex: '#000000' }],
  sizes: ['M'], variants: [{ colorId: 'black', size: 'M', stock: 0 }],
  material: '', fit: '', care: '', featured: false
});
const FIELD_NAMES: Record<string, string> = {
  id: 'شناسه', slug: 'آدرس محصول', name: 'نام', category: 'دسته‌بندی', description: 'توضیحات (حداقل ۱۰ نویسه)',
  price: 'قیمت فروش', compareAt: 'قیمت قبل از تخفیف (باید از قیمت فروش کمتر نباشد)', images: 'تصاویر',
  colors: 'رنگ‌ها', sizes: 'سایزها', variants: 'موجودی رنگ و سایز', material: 'جنس', fit: 'فرم', care: 'نگهداری'
};
const toLatinDigits = (value: string) => value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const parseSizes = (text: string) => [...new Set(text.split(/[,،]/).map(x => x.trim()).filter(Boolean))];

function Field({ title, hint, children, wide }: { title: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return <label className={'admin-field' + (wide ? ' admin-field-wide' : '')}><span>{title}</span>{children}
    {hint && <small>{hint}</small>}</label>;
}

export function ProductEditor({ productId, permissions, done }: {
  productId?: string; permissions: string[]; done: (saved: boolean) => void;
}) {
  const canPrice = permissions.includes('products:price');
  const canStock = permissions.includes('inventory:write');
  const [item, setItem] = useState<CatalogProduct>(empty);
  const [sizeText, setSizeText] = useState('M');
  const [revision, setRevision] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(productId));
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const fetchProduct = useCallback(() =>
    adminApi<{ item: CatalogProduct; revision: string }>('products/' + productId), [productId]);
  const apply = (data: { item: CatalogProduct; revision: string }) => {
    setItem({ ...empty(), ...data.item });
    setSizeText(data.item.sizes.join(', '));
    setRevision(data.revision);
  };
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    fetchProduct().then(data => { if (!cancelled) apply(data); })
      .catch(cause => { if (!cancelled) setError(errorMessage(cause)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId, fetchProduct]);
  useEffect(() => { if (!loading) heading.current?.focus(); }, [loading]);

  const sizes = useMemo(() => parseSizes(sizeText), [sizeText]);
  const combination = useMemo(() => item.colors.flatMap(c => sizes.map(size => ({
    colorId: c.id, size, stock: item.variants.find(v => v.colorId === c.id && v.size === size)?.stock ?? 0
  }))), [item.colors, item.variants, sizes]);
  const edit = <K extends keyof CatalogProduct>(key: K, value: CatalogProduct[K]) =>
    setItem(prev => ({ ...prev, [key]: value }));
  const moveImage = (from: number, to: number) => setItem(prev => {
    const images = [...prev.images];
    const [moved] = images.splice(from, 1);
    images.splice(to, 0, moved);
    return { ...prev, images };
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
    if (!sizes.length) return 'حداقل یک سایز لازم است.';
    if (!item.colors.length || item.colors.some(c => !IDENT.test(c.id) || !c.name.trim())) return 'شناسه هر رنگ باید لاتین (مثل navy-blue) و نام آن پر باشد.';
    if (new Set(item.colors.map(c => c.id)).size !== item.colors.length) return 'شناسه رنگ‌ها نباید تکراری باشد.';
    if (item.compareAt !== null && item.compareAt < item.price) return 'قیمت قبل از تخفیف نباید از قیمت فروش کمتر باشد.';
    return null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setMessage(''); setStale(false);
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    const payload: CatalogProduct = {
      id: item.id, slug: item.slug, name: item.name, category: item.category, description: item.description,
      price: item.price, compareAt: item.compareAt, images: item.images, sizes, variants: combination,
      colors: item.colors.map(({ id, name, hex, familyId }) => ({ id: id.trim(), name: name.trim(), hex, ...(familyId ? { familyId } : {}) })),
      material: item.material, fit: item.fit, care: item.care, featured: item.featured
    };
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
        <h2 id="editor-title" ref={heading} tabIndex={-1}>{productId ? 'ویرایش محصول' : 'افزودن محصول جدید'}</h2>
        <p>{productId ? <bdi dir="ltr">{productId}</bdi> : 'محصول جدید به‌صورت پیش‌نویس ذخیره می‌شود و بعد از افزودن تصویر قابل انتشار است.'} · مبالغ به تومان</p>
      </div>
      <button type="button" className="admin-btn admin-btn-outline" onClick={() => done(false)}>
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
          <Field title="دسته‌بندی">
            <select value={item.category} onChange={event => edit('category', event.target.value as CatalogProduct['category'])}>
              <option value="shomiz">شومیز</option><option value="manto">مانتو</option><option value="tshirt">تیشرت</option>
            </select>
          </Field>
          <Field title="قیمت فروش (تومان)" hint={priceLock}>
            <input type="text" inputMode="numeric" dir="ltr" required disabled={!canPrice} value={String(item.price)}
              onChange={event => edit('price', Number(toLatinDigits(event.target.value).replace(/\D/g, '')) || 0)}/>
          </Field>
          <Field title="قیمت قبل از تخفیف (اختیاری)" hint={priceLock ?? 'اگر پر شود، روی کارت محصول خط می‌خورد.'}>
            <input type="text" inputMode="numeric" dir="ltr" disabled={!canPrice} value={item.compareAt ?? ''}
              onChange={event => {
                const digits = toLatinDigits(event.target.value).replace(/\D/g, '');
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
        </ol> : <Notice tone="warning">این محصول هنوز تصویری ندارد؛ ذخیره پیش‌نویس ممکن است، اما انتشار بدون تصویر مجاز نیست.</Notice>}
      </fieldset>

      <fieldset className="admin-fieldset" disabled={!canStock}>
        <legend>رنگ‌ها و سایزها</legend>
        <p className="admin-hint">شناسه هر رنگ لاتین است (مثلاً navy یا light-blue) و بعد از ثبت سفارش بهتر است تغییر نکند.</p>
        {stockLock && <p className="admin-hint">{stockLock}؛ رنگ، سایز و موجودی فقط نمایش داده می‌شوند.</p>}
        <div className="admin-stack-sm">
          {item.colors.map((color, idx) => <div key={idx} className="admin-color-row">
            <Field title="نام رنگ">
              <input required value={color.name}
                onChange={event => edit('colors', item.colors.map((c, j) => j === idx ? { ...c, name: event.target.value } : c))}/>
            </Field>
            <Field title="شناسه لاتین">
              <input dir="ltr" required value={color.id} pattern="[a-z0-9][a-z0-9\-]{1,78}"
                onChange={event => edit('colors', item.colors.map((c, j) => j === idx ? { ...c, id: event.target.value.toLowerCase() } : c))}/>
            </Field>
            <Field title="رنگ نمونه">
              <input type="color" value={color.hex}
                onChange={event => edit('colors', item.colors.map((c, j) => j === idx ? { ...c, hex: event.target.value } : c))}/>
            </Field>
            <button type="button" className="admin-btn admin-btn-danger admin-btn-small" disabled={item.colors.length === 1}
              onClick={() => edit('colors', item.colors.filter((_, j) => j !== idx))}
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
          {combination.map(variant => <label key={variant.colorId + '-' + variant.size} className="admin-stock-cell">
            <span>{item.colors.find(c => c.id === variant.colorId)?.name || variant.colorId} / <bdi>{variant.size}</bdi></span>
            <input type="number" inputMode="numeric" min="0" max="1000000" required dir="ltr"
              value={variant.stock} onChange={event => {
                const stock = Math.max(0, Number(event.target.value) || 0);
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
        <button type="button" onClick={() => done(false)} className="admin-btn admin-btn-outline">انصراف</button>
      </div>
    </form>
  </section>;
}
