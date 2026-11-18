'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Palette, Plus, Star, Trash2, X } from 'lucide-react';
import { adminApi, AdminApiError, errorMessage } from '@/components/admin/admin-api';
import { digitsOnly, formatNumber, PRODUCT_STATUS } from '@/components/admin/labels';
import {
  COLOR_PRESETS, discountPercent, latinSlug, orderSizes, SIZE_GROUPS, suggestedAddress, SUGGESTIONS, uniqueIdent
} from '@/components/admin/product-form';
import { AmountInput, Badge, Loading, Notice } from '@/components/admin/ui';

// `auto` marks a colour added in this form without a preset: its Latin id follows its Persian name until saved.
type Color = { id: string; name: string; hex: string; familyId?: string; auto?: boolean };
type Variant = { colorId: string; size: string; stock: number };
type CatalogProduct = {
  id: string; slug: string; name: string; category: 'shomiz' | 'manto' | 'tshirt';
  description: string; price: number; compareAt: number | null; images: string[];
  colors: Color[]; sizes: string[]; variants: Variant[];
  material: string; fit: string; care: string; featured: boolean;
};
type Status = 'active' | 'draft' | 'archived';
type Loaded = { item: CatalogProduct & { status: Status }; revision: string };
export type EditorNotice = { tone: 'success' | 'warning'; text: string };
const MAX_IMAGES = 8;
const IDENT = /^[a-z0-9][a-z0-9-]{1,78}$/;
export const UNSAVED_CHANGES = 'تغییرات ذخیره‌نشده فرم محصول از بین می‌رود. ادامه می‌دهید؟';
const empty = (): CatalogProduct => ({
  id: '', slug: '', name: '', category: 'shomiz', description: '',
  price: 0, compareAt: null, images: [], colors: [{ id: 'black', name: 'مشکی', hex: '#1f1f1f' }],
  sizes: ['M'], variants: [{ colorId: 'black', size: 'M', stock: 0 }],
  material: '', fit: '', care: '', featured: false
});
const FIELD_NAMES: Record<string, string> = {
  id: 'آدرس صفحه محصول', slug: 'آدرس صفحه محصول', name: 'نام', category: 'دسته‌بندی', description: 'توضیحات (حداقل ۱۰ نویسه)',
  price: 'قیمت فروش', compareAt: 'قیمت قبل از تخفیف (باید از قیمت فروش کمتر نباشد)', images: 'تصاویر',
  colors: 'رنگ‌ها', sizes: 'سایزها', variants: 'موجودی رنگ و سایز', material: 'جنس', fit: 'فرم', care: 'نگهداری'
};
/** What the API receives: one stock row per color × size, in form order. Also the basis of the unsaved-changes check. */
function payloadOf(item: CatalogProduct): Omit<CatalogProduct, 'colors'> & { colors: Omit<Color, 'auto'>[] } {
  const sizes = orderSizes(item.sizes);
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
const fingerprint = (item: CatalogProduct) => JSON.stringify(payloadOf(item));

function Field({ title, hint, children, wide }: { title: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return <label className={'admin-field' + (wide ? ' admin-field-wide' : '')}><span>{title}</span>{children}
    {hint && <small>{hint}</small>}</label>;
}

/** Edits `productId`, creates a new draft, or (with `copyOf`) a new draft prefilled from another product. `done` gets
 * whether something was saved and, when it differs from the plain «saved», what to tell the user. */
export function ProductEditor({ productId, copyOf, permissions, done, onUnsaved }: {
  productId?: string; copyOf?: string; permissions: string[]; done: (saved: boolean, notice?: EditorNotice) => void;
  onUnsaved?: (question: string | null) => void;
}) {
  const canPrice = permissions.includes('products:price');
  const canStock = permissions.includes('inventory:write');
  const source = productId ?? copyOf;
  const [item, setItem] = useState<CatalogProduct>(empty);
  const [baseline, setBaseline] = useState(() => fingerprint(empty()));
  const [status, setStatus] = useState<Status>('draft');
  const [revision, setRevision] = useState('');
  // A new product's address follows its name until someone types an address of their own.
  const [autoAddress, setAutoAddress] = useState(!productId);
  const [advanced, setAdvanced] = useState(false);
  const [palette, setPalette] = useState(false);
  const [customSize, setCustomSize] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(source));
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [removedImage, setRemovedImage] = useState<{ src: string; index: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const fetchProduct = useCallback(() => adminApi<Loaded>('products/' + source), [source]);
  const apply = useCallback((data: Loaded) => {
    const { status: loaded, ...product } = data.item;
    // A copy is a new product: it gets its own address, starts as a draft, and holds no stock until counted.
    const next: CatalogProduct = copyOf ? {
      ...empty(), ...product, id: (product.id + '-copy').slice(0, 79), slug: (product.slug + '-copy').slice(0, 100),
      name: product.name + ' (کپی)', variants: product.variants.map(v => ({ ...v, stock: 0 }))
    } : { ...empty(), ...product };
    setItem(next); setBaseline(fingerprint(next)); setRemovedImage(null);
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

  const payload = useMemo(() => payloadOf(item), [item]);
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
  const editName = (name: string) => setItem(prev => {
    const slug = autoAddress ? latinSlug(name) : '';
    return slug.length >= 2 ? { ...prev, name, id: slug, slug } : { ...prev, name };
  });
  const moveImage = (from: number, to: number) => setItem(prev => {
    const images = [...prev.images];
    const [moved] = images.splice(from, 1);
    images.splice(to, 0, moved);
    return { ...prev, images };
  });
  const removeImage = (index: number) => {
    setRemovedImage({ src: item.images[index], index });
    edit('images', item.images.filter((_, i) => i !== index));
  };
  const undoImageRemoval = () => {
    if (!removedImage || item.images.length >= MAX_IMAGES) return;
    const images = [...item.images];
    images.splice(Math.min(removedImage.index, images.length), 0, removedImage.src);
    edit('images', images);
    setRemovedImage(null);
  };
  const editColor = (index: number, patch: Partial<Color>) =>
    setItem(prev => ({ ...prev, colors: prev.colors.map((c, j) => j === index ? { ...c, ...patch } : c) }));
  // Renaming a colour added here also renames its Latin id; stock entered for it moves along.
  const renameColor = (index: number, name: string) => setItem(prev => {
    const color = prev.colors[index];
    if (!color.auto) return { ...prev, colors: prev.colors.map((c, j) => j === index ? { ...c, name } : c) };
    const others = prev.colors.filter((_, j) => j !== index).map(c => c.id);
    const id = uniqueIdent(latinSlug(name), others, uniqueIdent('color', others, 'color'));
    return { ...prev, colors: prev.colors.map((c, j) => j === index ? { ...c, name, id } : c),
      variants: prev.variants.filter(v => v.colorId !== id).map(v => v.colorId === color.id ? { ...v, colorId: id } : v) };
  });
  const removeColor = (index: number) => setItem(prev => {
    const id = prev.colors[index].id;
    return { ...prev, colors: prev.colors.filter((_, j) => j !== index), variants: prev.variants.filter(v => v.colorId !== id) };
  });
  const addPreset = (preset: Color) => {
    setItem(prev => ({ ...prev, colors: [...prev.colors, { ...preset }] }));
    setPalette(false);
  };
  const addCustomColor = () => {
    setItem(prev => {
      const id = uniqueIdent('color', prev.colors.map(c => c.id), 'color');
      return { ...prev, colors: [...prev.colors, { id, name: '', hex: '#8a8a8a', auto: true }] };
    });
    setPalette(false);
  };
  const toggleSize = (size: string) => setItem(prev => ({
    ...prev, sizes: prev.sizes.includes(size) ? prev.sizes.filter(s => s !== size) : orderSizes([...prev.sizes, size])
  }));
  const addCustomSize = () => {
    const size = customSize.trim().slice(0, 20);
    if (!size) return;
    if (!item.sizes.includes(size)) toggleSize(size);
    setCustomSize('');
  };

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

  function validate(publish: boolean): string | null {
    if (item.name.trim().length < 2) return 'نام محصول را بنویسید.';
    if (!autoAddress && (!IDENT.test(item.id) || !/^[a-z0-9][a-z0-9-]{1,99}$/.test(item.slug))) {
      setAdvanced(true);
      return 'آدرس صفحه محصول فقط می‌تواند حروف کوچک لاتین، عدد و خط تیره باشد (مثلاً manto-linen).';
    }
    if (!payload.sizes.length) return 'دست‌کم یک سایز انتخاب کنید.';
    if (!item.colors.length) return 'دست‌کم یک رنگ اضافه کنید.';
    if (item.colors.some(c => !c.name.trim())) return 'نام همه رنگ‌ها را بنویسید.';
    if (item.colors.some(c => !IDENT.test(c.id)) || new Set(item.colors.map(c => c.id)).size !== item.colors.length)
      return 'یکی از رنگ‌ها تکراری است؛ آن را حذف کنید و دوباره اضافه کنید.';
    if (item.compareAt !== null && item.compareAt < item.price) return 'قیمت قبل از تخفیف نباید از قیمت فروش کمتر باشد.';
    if ((publish || status === 'active') && !item.images.length) return status === 'active'
      ? 'این محصول منتشرشده است و باید دست‌کم یک تصویر داشته باشد؛ برای حذف همه تصاویر، ابتدا آن را از فهرست آرشیو کنید.'
      : 'برای انتشار در فروشگاه دست‌کم یک عکس لازم است؛ یا عکس اضافه کنید یا «پیش‌نویس» ذخیره کنید.';
    if ((publish || status === 'active') && item.price <= 0) return 'برای انتشار، قیمت فروش باید بیشتر از صفر باشد.';
    return null;
  }

  /** Creates the product. An address that follows the name takes the next free «-2», «-3»… when another product has
   * it: looked up first, and retried if someone else took it in the meantime. */
  async function create(body: ReturnType<typeof payloadOf>) {
    const base = IDENT.test(body.id) ? body.id : suggestedAddress(body.name, body.category);
    const taken = new Set<string>();
    if (autoAddress) {
      try {
        const found = await adminApi<{ items: { id: string; slug: string }[] }>('products?' + new URLSearchParams({ q: base, limit: '100' }));
        for (const product of found.items) { taken.add(product.id); taken.add(product.slug); }
      } catch { /* the retry below still finds a free address */ }
    }
    for (let attempt = 1; ; attempt++) {
      const id = autoAddress ? uniqueIdent(base, taken, base) : base;
      try {
        await adminApi('products', { method: 'POST', body: { ...body, id, slug: autoAddress ? id : body.slug } });
        return id;
      } catch (cause) {
        if (!(autoAddress && attempt < 20 && cause instanceof AdminApiError && cause.code === 'product_exists')) throw cause;
        taken.add(id);
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const publish = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-publish') === 'true';
    setError(''); setMessage(''); setStale(false);
    const invalid = validate(publish);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    let saved: string | null = null;
    try {
      if (productId) {
        await adminApi('products/' + productId, { method: 'PUT', body: payload, headers: { 'If-Match': '"' + revision + '"' } });
        saved = productId;
      } else saved = await create(payload);
      if (!publish) { done(true); return; }
      try {
        await adminApi('products/' + saved + '/visibility', { method: 'PATCH', body: { active: true } });
        done(true, { tone: 'success', text: 'محصول ذخیره و در فروشگاه منتشر شد.' });
      } catch (cause) {
        done(true, { tone: 'warning', text: 'محصول ذخیره شد، ولی منتشر نشد: ' + errorMessage(cause) });
      }
    } catch (cause) {
      if (cause instanceof AdminApiError && cause.code === 'product_changed_reload_required') setStale(true);
      if (cause instanceof AdminApiError && cause.code === 'product_exists') setAdvanced(true);
      const fields = cause instanceof AdminApiError
        ? Object.keys((cause.data.details as { fieldErrors?: Record<string, unknown> } | undefined)?.fieldErrors ?? {}) : [];
      const permission = cause instanceof AdminApiError ? cause.data.permission : undefined;
      setError(errorMessage(cause) + (fields.length ? ' موارد: ' + [...new Set(fields.map(f => FIELD_NAMES[f] ?? f))].join('، ') : '') +
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
  const percent = discountPercent(item.price, item.compareAt);
  const usedColors = new Set(item.colors.map(c => c.id));
  const customSizes = item.sizes.filter(size => !SIZE_GROUPS.some(group => group.sizes.includes(size)));
  const isNew = !productId;
  return <section className="admin-panel" aria-labelledby="editor-title">
    <div className="admin-panel-head">
      <div>
        <h2 id="editor-title" ref={heading} tabIndex={-1}>
          {productId ? 'ویرایش محصول' : copyOf ? 'کپی محصول' : 'افزودن محصول جدید'}
          {productId && <Badge tone={PRODUCT_STATUS[status].tone}>{PRODUCT_STATUS[status].label}</Badge>}
        </h2>
        <p>{productId ? item.name : copyOf
          ? 'موجودی‌ها صفر شده‌اند؛ نام، عکس‌ها و رنگ‌ها را برای کالای تازه تغییر دهید'
          : 'نام، قیمت، عکس، رنگ و سایز را وارد کنید؛ بقیه کارها خودکار انجام می‌شود.'} · مبالغ به تومان</p>
      </div>
      <button type="button" className="admin-btn admin-btn-outline" onClick={leave}>
        <ArrowRight size={15} aria-hidden="true"/> بازگشت به فهرست</button>
    </div>
    <form onSubmit={submit} className="admin-panel-body admin-form" noValidate={false}>
      <fieldset className="admin-fieldset">
        <legend>اطلاعات اصلی</legend>
        <div className="admin-form-grid">
          <Field title="نام محصول" hint="همان نامی که مشتری در سایت می‌بیند؛ مثلاً «مانتو کتان سارا».">
            <input required minLength={2} maxLength={200} value={item.name} onChange={event => editName(event.target.value)}/>
          </Field>
          <Field title="دسته‌بندی">
            <select value={item.category} onChange={event => edit('category', event.target.value as CatalogProduct['category'])}>
              <option value="shomiz">شومیز</option><option value="manto">مانتو</option><option value="tshirt">تیشرت</option>
            </select>
          </Field>
          <Field title="قیمت فروش (تومان)" hint={priceLock ?? (status === 'active' ? undefined : 'برای انتشار، قیمت باید بیشتر از صفر باشد.')}>
            <AmountInput required disabled={!canPrice} value={item.price ? String(item.price) : ''}
              placeholder="مثلاً 1,250,000" onDigits={digits => edit('price', Number(digits) || 0)}/>
          </Field>
          <Field title="قیمت قبل از تخفیف (اختیاری)" hint={priceLock ?? (percent
            ? <>روی سایت با <strong>{formatNumber(percent)}٪ تخفیف</strong> و قیمت قبلیِ خط‌خورده نمایش داده می‌شود.</>
            : 'فقط وقتی حراج دارید پر کنید؛ روی کارت محصول خط می‌خورد.')}>
            <AmountInput disabled={!canPrice} value={item.compareAt === null ? '' : String(item.compareAt)}
              onDigits={digits => edit('compareAt', digits === '' ? null : Number(digits))}/>
          </Field>
          <Field title="توضیحات محصول" wide hint="چند جمله درباره پارچه، دوخت و استایل (حداقل ۱۰ نویسه).">
            <textarea required rows={4} minLength={10} maxLength={4000}
              value={item.description} onChange={event => edit('description', event.target.value)}/>
          </Field>
          {([['material', 'جنس پارچه'], ['fit', 'فرم لباس'], ['care', 'راهنمای نگهداری']] as const)
            .map(([key, label]) => <Field key={key} title={label} hint="از پیشنهادها انتخاب کنید یا خودتان بنویسید.">
              <input required list={'product-' + key + '-suggestions'} value={item[key]} onChange={event => edit(key, event.target.value)}/>
              <datalist id={'product-' + key + '-suggestions'}>{SUGGESTIONS[key].map(text => <option key={text} value={text}/>)}</datalist>
            </Field>)}
          <label className="admin-check">
            <input type="checkbox" checked={item.featured} onChange={event => edit('featured', event.target.checked)}/>
            <span>محصول ویژه<small>در مرتب‌سازی «پیشنهاد ما» جلوتر نمایش داده می‌شود.</small></span>
          </label>
          <details className="admin-advanced admin-field-wide" open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)}>
            <summary>آدرس صفحه محصول <small>{autoAddress ? 'خودکار از روی نام ساخته می‌شود؛ لازم نیست تغییرش دهید' : 'لاتین'}</small></summary>
            <p className="admin-hint">نشانی صفحه: <bdi dir="ltr" className="admin-mono">/product/{item.slug || '…'}</bdi></p>
            <div className="admin-form-grid">
              <Field title="شناسه ثابت (لاتین)" hint={productId ? 'شناسه بعد از ایجاد تغییر نمی‌کند.' : 'برای جست‌وجو در پنل؛ مثلاً manto-linen-01'}>
                <input dir="ltr" disabled={Boolean(productId)} value={item.id} pattern="[a-z0-9][a-z0-9\-]{1,78}"
                  onChange={event => { setAutoAddress(false); edit('id', event.target.value.toLowerCase()); }}/>
              </Field>
              <Field title="آدرس محصول (slug)" hint="حروف کوچک لاتین، عدد و خط تیره؛ در نشانی صفحه محصول دیده می‌شود.">
                <input dir="ltr" pattern="[a-z0-9][a-z0-9\-]{1,99}" value={item.slug}
                  onChange={event => { setAutoAddress(false); edit('slug', event.target.value.toLowerCase()); }}/>
              </Field>
            </div>
          </details>
        </div>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>عکس‌های محصول</legend>
        <p className="admin-hint">عکس‌ها را بکشید و اینجا رها کنید یا انتخاب کنید (JPG، PNG یا WebP، هر کدام حداکثر ۲ مگابایت، حداکثر {formatNumber(MAX_IMAGES)} عکس). عکس اول، عکس اصلی ویترین است و عکس‌ها خودکار سبک می‌شوند.</p>
        <label className={'admin-upload' + (uploading || item.images.length >= MAX_IMAGES ? ' is-disabled' : '') + (dragging ? ' is-dragging' : '')}
          onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault(); setDragging(false);
            if (!uploading && item.images.length < MAX_IMAGES && event.dataTransfer.files.length) void upload(event.dataTransfer.files);
          }}>
          <ImagePlus size={20} aria-hidden="true"/>
          <span>{uploading ? 'در حال بارگذاری…' : dragging ? 'رها کنید تا بارگذاری شود' : 'انتخاب تصویر (امکان انتخاب چند فایل)'}</span>
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
              <button type="button" className="admin-btn admin-btn-danger admin-btn-small"
                onClick={() => removeImage(idx)}
                aria-label={'حذف تصویر ' + formatNumber(idx + 1) + ' از محصول'}><Trash2 size={15} aria-hidden="true"/> حذف</button>
            </div>
          </li>)}
        </ol> : <Notice tone="warning">{status === 'active'
          ? 'این محصول منتشرشده است و بدون تصویر ذخیره نمی‌شود؛ دست‌کم یک تصویر اضافه کنید.'
          : 'این محصول هنوز تصویری ندارد؛ ذخیره پیش‌نویس ممکن است، اما انتشار بدون تصویر مجاز نیست.'}</Notice>}
        {removedImage && <Notice tone="info">آخرین تصویر از این محصول برداشته شد؛ بعد از ذخیره اعمال می‌شود.
          <button type="button" className="admin-btn admin-btn-outline admin-btn-small admin-notice-action"
            disabled={uploading || item.images.length >= MAX_IMAGES} onClick={undoImageRemoval}>بازگرداندن تصویر</button>
        </Notice>}
      </fieldset>

      <fieldset className="admin-fieldset" disabled={!canStock}>
        <legend>رنگ‌ها</legend>
        {stockLock && <p className="admin-hint">{stockLock}؛ رنگ، سایز و موجودی فقط نمایش داده می‌شوند.</p>}
        <ul className="admin-color-list" aria-label="رنگ‌های این محصول">
          {item.colors.map((color, idx) => <li key={idx} className="admin-color-row">
            <label className="admin-color-swatch" title="تغییر رنگ نمونه">
              <span className="sr-only">رنگ نمونه {color.name || formatNumber(idx + 1)}</span>
              <input type="color" value={color.hex} onChange={event => editColor(idx, { hex: event.target.value })}/>
            </label>
            <Field title="نام رنگ">
              <input required value={color.name} placeholder="مثلاً فیروزه‌ای" onChange={event => renameColor(idx, event.target.value)}/>
            </Field>
            <button type="button" className="admin-icon-btn admin-icon-danger" disabled={item.colors.length === 1}
              onClick={() => removeColor(idx)} aria-label={'حذف رنگ ' + (color.name || formatNumber(idx + 1))}>
              <Trash2 size={15} aria-hidden="true"/></button>
          </li>)}
        </ul>
        <div>
          <button className="admin-btn admin-btn-outline admin-btn-small" type="button" aria-expanded={palette}
            aria-controls="color-palette" onClick={() => setPalette(open => !open)}>
            <Palette size={15} aria-hidden="true"/> افزودن رنگ</button>
        </div>
        {palette && <div id="color-palette" className="admin-palette" role="group" aria-label="انتخاب رنگ">
          {COLOR_PRESETS.filter(preset => !usedColors.has(preset.id)).map(preset => <button key={preset.id} type="button"
            className="admin-palette-color" onClick={() => addPreset(preset)} aria-label={'افزودن رنگ ' + preset.name}>
            <i style={{ background: preset.hex }} aria-hidden="true"/>{preset.name}</button>)}
          <button type="button" className="admin-palette-color" onClick={addCustomColor}>
            <Plus size={14} aria-hidden="true"/> رنگ دیگر با نام دلخواه</button>
        </div>}
      </fieldset>

      <fieldset className="admin-fieldset" disabled={!canStock}>
        <legend>سایزها</legend>
        <p className="admin-hint">سایزهایی را که از این کالا دارید روشن کنید.</p>
        {SIZE_GROUPS.map(group => <div key={group.title} className="admin-size-group" role="group" aria-label={'سایزهای ' + group.title}>
          <span className="admin-size-title">{group.title}</span>
          {group.sizes.map(size => <button key={size} type="button" className="admin-size" aria-pressed={item.sizes.includes(size)}
            onClick={() => toggleSize(size)}>{size}</button>)}
        </div>)}
        {customSizes.length > 0 && <div className="admin-size-group" role="group" aria-label="سایزهای دیگر">
          <span className="admin-size-title">دیگر</span>
          {customSizes.map(size => <button key={size} type="button" className="admin-size" aria-pressed="true"
            onClick={() => toggleSize(size)} aria-label={'برداشتن سایز ' + size}>{size} <X size={13} aria-hidden="true"/></button>)}
        </div>}
        <div className="admin-inline">
          <label className="admin-inline-field admin-nowrap">سایز دیگر
            <input value={customSize} maxLength={20} placeholder="مثلاً ۲ (بچگانه)" onChange={event => setCustomSize(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustomSize(); } }}/>
          </label>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={!customSize.trim()}
            onClick={addCustomSize}>افزودن سایز</button>
        </div>
      </fieldset>

      <fieldset className="admin-fieldset" disabled={!canStock}>
        <legend>موجودی هر رنگ و سایز</legend>
        <p className="admin-hint">تعداد موجود از هر رنگ و سایز. برای کالایی که تازه رسیده، می‌توانید صفر بگذارید و از «ورود کالا و برچسب» وارد کنید.</p>
        {payload.variants.length ? <div className="admin-stock-grid">
          {payload.variants.map(variant => <label key={variant.colorId + '-' + variant.size} className="admin-stock-cell">
            <span>{item.colors.find(c => c.id === variant.colorId)?.name || 'رنگ بی‌نام'} / <bdi>{variant.size}</bdi></span>
            <input type="text" inputMode="numeric" maxLength={7} required dir="ltr"
              value={String(variant.stock)} onChange={event => {
                const stock = Math.min(1_000_000, Number(digitsOnly(event.target.value)) || 0);
                setItem(prev => ({ ...prev, variants: [
                  ...prev.variants.filter(v => !(v.colorId === variant.colorId && v.size === variant.size)),
                  { colorId: variant.colorId, size: variant.size, stock }
                ] }));
              }}/>
          </label>)}
        </div> : <p className="admin-hint">اول دست‌کم یک رنگ و یک سایز انتخاب کنید.</p>}
      </fieldset>

      {error && <Notice tone="error">{error}
        {stale && <button type="button" className="admin-btn admin-btn-outline admin-btn-small admin-notice-action"
          onClick={() => void reloadLatest()}>بارگذاری آخرین نسخه</button>}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      <div className="admin-actions admin-sticky-actions">
        {status !== 'active' && <button type="submit" data-publish="true" disabled={busy || uploading} className="admin-btn admin-btn-primary">
          {busy ? 'در حال ذخیره…' : isNew ? 'ایجاد و انتشار در فروشگاه' : 'ذخیره و انتشار در فروشگاه'}</button>}
        <button type="submit" disabled={busy || uploading}
          className={'admin-btn ' + (status === 'active' ? 'admin-btn-primary' : 'admin-btn-outline')}>
          {busy ? 'در حال ذخیره…' : isNew ? 'ایجاد پیش‌نویس محصول' : 'ذخیره تغییرات محصول'}
        </button>
        <button type="button" onClick={leave} className="admin-btn admin-btn-outline">انصراف</button>
        {dirty && <span className="admin-sub">تغییرات ذخیره‌نشده دارید.</span>}
      </div>
    </form>
  </section>;
}
