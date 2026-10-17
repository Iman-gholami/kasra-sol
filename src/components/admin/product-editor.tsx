'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

type Color = { id: string; name: string; hex: string; familyId?: string };
type Variant = { colorId: string; size: string; stock: number };
type CatalogProduct = {
  id: string; slug: string; name: string; category: 'shomiz' | 'manto' | 'tshirt';
  description: string; price: number; compareAt: number | null; images: string[];
  colors: Color[]; sizes: string[]; variants: Variant[];
  material: string; fit: string; care: string; featured: boolean; active?: boolean;
};
const empty = (): CatalogProduct => ({
  id: '', slug: '', name: '', category: 'shomiz', description: '',
  price: 0, compareAt: null, images: [], colors: [{ id: 'black', name: 'مشکی', hex: '#000000' }],
  sizes: ['M'], variants: [{ colorId: 'black', size: 'M', stock: 0 }],
  material: '', fit: '', care: '', featured: false
});
type Props = { productId?: string; done: () => void };
const inputClass = 'w-full rounded-md border border-neutral-300 bg-white p-2';
function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm"><span>{title}</span>{children}</label>;
}
export function ProductEditor({ productId, done }: Props) {
  const [item, setItem] = useState<CatalogProduct>(empty);
  const [sizeText, setSizeText] = useState('M');
  const [revision, setRevision] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(productId));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    void fetch('/api/admin/products/' + productId, { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('اطلاعات محصول دریافت نشد.');
      return response.json() as Promise<{ item: CatalogProduct; revision: string }>;
    }).then(data => {
      if (!cancelled) { setItem(data.item); setSizeText(data.item.sizes.join(', ')); setRevision(data.revision); }
    }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'خطا'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [productId]);
  const sizes = useMemo(() =>
    sizeText.split(',').map(x => x.trim()).filter(Boolean), [sizeText]);
  const combination = useMemo(() => item.colors.flatMap(c => sizes.map(size => ({
    colorId: c.id, size, stock: item.variants.find(v => v.colorId === c.id && v.size === size)?.stock ?? 0
  }))), [item.colors, item.variants, sizes]);
  const edit = <K extends keyof CatalogProduct>(key: K, value: CatalogProduct[K]) =>
    setItem(prev => ({ ...prev, [key]: value }));

  async function upload(file: File) {
    setError(''); setMessage('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024 || file.size === 0) {
      setError('تصویر باید JPG، PNG یا WebP و حداکثر ۲ مگابایت باشد.'); return;
    }
    if (item.images.length >= 8) { setError('برای هر محصول حداکثر ۸ تصویر مجاز است.'); return; }
    setUploading(true);
    try {
      const response = await fetch('/api/admin/media', {
        method: 'POST', headers: { 'Content-Type': file.type }, body: file
      });
      if (!response.ok) throw new Error('آپلود تصویر ناموفق بود (کد ' + response.status + ').');
      const uploaded = await response.json() as { url: string };
      setItem(prev => ({ ...prev, images: [...prev.images, uploaded.url].slice(0, 8) }));
      setMessage('تصویر ذخیره شد؛ برای نمایش در فروشگاه، تغییرات محصول را هم ثبت کنید.');
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا در آپلود تصویر'); }
    finally { setUploading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setMessage('');
    const payload = {
      ...item, sizes, variants: combination,
      colors: item.colors.map(({ id, name, hex, familyId }) => ({ id: id.trim(), name: name.trim(), hex, ...(familyId ? { familyId } : {}) })),
      compareAt: item.compareAt === null ? null : Number(item.compareAt)
    };
    delete (payload as Partial<CatalogProduct>).active;
    if (!payload.images.length) { setError('برای ذخیره پیش‌نویس هم بهتر است حداقل یک تصویر اضافه کنید.'); }
    if (new Set(sizes).size !== sizes.length || !sizes.length) {
      setError('سایزها نباید تکراری یا خالی باشند.'); return;
    }
    if (item.colors.some(c => !c.id || !c.name) || !item.colors.length) {
      setError('حداقل یک رنگ معتبر لازم است.'); return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/admin/products' + (productId ? '/' + productId : ''), {
        method: productId ? 'PUT' : 'POST', headers: {
          'Content-Type': 'application/json', ...(productId ? { 'If-Match': '"' + revision + '"' } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error === 'product_exists'
          ? 'شناسه یا آدرس محصول تکراری است.' : result.error === 'product_changed_reload_required'
            ? 'موجودی یا مشخصات محصول در این فاصله تغییر کرده. فرم را دوباره باز کنید تا اطلاعات جدید جایگزین نشود.' : 'ذخیره محصول ناموفق بود (کد ' + response.status + ').');
      }
      done();
    } catch (err) { setError(err instanceof Error ? err.message : 'خطا در ذخیره محصول'); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">در حال دریافت محصول…</p>;
  return <section className="admin-form-card grid gap-3">
    <div className="mb-4 flex flex-wrap justify-between gap-3">
      <h2 className="text-xl font-semibold">{productId ? 'ویرایش کامل محصول' : 'افزودن محصول جدید'}</h2>
      <button type="button" className="admin-btn admin-btn-outline" onClick={done}>بازگشت به فهرست</button>
    </div>
    <p className="mb-4 text-sm text-neutral-600">محصول جدید ابتدا به‌صورت پیش‌نویس ایجاد می‌شود. بعد از ثبت عکس و موجودی آن را منتشر کنید. مبلغ‌ها تومان هستند.</p>
    <form onSubmit={submit} className="grid gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">اطلاعات اصلی</legend>
        <Field title="شناسه ثابت (لاتین، حداقل دو حرف/عدد)">
          <input className={inputClass} dir="ltr" required disabled={Boolean(productId)} value={item.id}
            pattern="[a-z0-9][a-z0-9-]{1,78}" onChange={event => edit('id', event.target.value)}/>
        </Field>
        <Field title="آدرس محصول (slug)">
          <input className={inputClass} dir="ltr" required pattern="[a-z0-9][a-z0-9-]{1,99}" value={item.slug}
            onChange={event => edit('slug', event.target.value)}/>
        </Field>
        <Field title="نام محصول">
          <input className={inputClass} required minLength={2} maxLength={200} value={item.name}
            onChange={event => edit('name', event.target.value)}/>
        </Field>
        <Field title="دسته‌بندی">
          <select className={inputClass} value={item.category}
            onChange={event => edit('category', event.target.value as CatalogProduct['category'])}>
            <option value="shomiz">شومیز</option>
            <option value="manto">مانتو</option>
            <option value="tshirt">تیشرت</option>
          </select>
        </Field>
        <Field title="قیمت فروش (تومان)">
          <input className={inputClass} type="number" required min="0" max="1000000000" value={item.price}
            onChange={event => edit('price', Number(event.target.value))}/>
        </Field>
        <Field title="قیمت قبل از تخفیف (اختیاری)">
          <input className={inputClass} type="number" min="0" max="1000000000" value={item.compareAt ?? ''}
            onChange={event => edit('compareAt', event.target.value === '' ? null : Number(event.target.value))}/>
        </Field>
        <div className="sm:col-span-2">
          <Field title="توضیحات محصول">
            <textarea className={inputClass} required rows={4} minLength={10} maxLength={4000}
              value={item.description} onChange={event => edit('description', event.target.value)}/>
          </Field>
        </div>
        {([['material', 'جنس پارچه'], ['fit', 'فرم لباس'], ['care', 'راهنمای نگهداری']] as const)
          .map(([key, label]) => <Field key={key} title={label}>
            <input className={inputClass} required value={item[key]} onChange={event => edit(key, event.target.value)}/>
          </Field>)}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={item.featured} onChange={event => edit('featured', event.target.checked)}/>
          محصول ویژه
        </label>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="font-semibold">عکس‌های محصول (حداکثر ۸ تصویر)</legend>
        <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="آپلود تصویر محصول"
          disabled={uploading || item.images.length >= 8}
          onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }}/>
        <p className="text-sm text-neutral-600">JPG، PNG یا WebP، حداکثر ۲ مگابایت برای هر تصویر. تصویر اول در ویترین نمایش داده می‌شود.</p>
        <div className="flex flex-wrap gap-3">
          {item.images.map((src, idx) => <div key={src + idx} className="relative rounded border p-2">
            <Image src={src} width={108} height={128} unoptimized alt={'تصویر ' + (idx + 1) + ' محصول'}
              className="h-32 w-28 object-cover"/>
            <button type="button" className="admin-btn admin-btn-outline admin-btn-small mt-2 w-full"
              onClick={() => edit('images', item.images.filter((_, i) => i !== idx))}>حذف از محصول</button>
            {idx > 0 && <button type="button" className="mt-1 block w-full text-sm underline" onClick={() => {
              const images = [...item.images]; [images[0], images[idx]] = [images[idx], images[0]];
              edit('images', images);
            }}>تصویر اصلی شود</button>}
          </div>)}
        </div>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="font-semibold">رنگ‌ها و سایزها</legend>
        <p className="text-sm text-neutral-600">شناسه رنگ را لاتین وارد کنید و سایزها را با ویرگول انگلیسی جدا کنید؛ برای هر ترکیب موجودی مشخص کنید.</p>
        {item.colors.map((color, idx) => <div key={idx} className="grid gap-2 rounded border p-3 sm:grid-cols-4">
          <Field title="شناسه رنگ (لاتین)">
            <input className={inputClass} dir="ltr" required value={color.id}
              onChange={event => edit('colors', item.colors.map((c, j) => j === idx ? { ...c, id: event.target.value } : c))}/>
          </Field>
          <Field title="نام رنگ">
            <input className={inputClass} required value={color.name}
              onChange={event => edit('colors', item.colors.map((c, j) => j === idx ? { ...c, name: event.target.value } : c))}/>
          </Field>
          <Field title="کد رنگ">
            <input className={inputClass} type="color" value={color.hex}
              onChange={event => edit('colors', item.colors.map((c, j) => j === idx ? { ...c, hex: event.target.value } : c))}/>
          </Field>
          <button type="button" className="admin-btn admin-btn-danger self-end" disabled={item.colors.length === 1}
            onClick={() => edit('colors', item.colors.filter((_, j) => j !== idx))}>حذف رنگ</button>
        </div>)}
        <button className="admin-btn admin-btn-outline" type="button"
          onClick={() => edit('colors', [...item.colors, { id: 'new-color-' + (item.colors.length + 1), name: 'رنگ جدید', hex: '#777777' }])}>
          افزودن رنگ
        </button>
        <Field title="سایزها، جداشده با ویرگول (مثلاً S,M,L)">
          <input className={inputClass} dir="ltr" required value={sizeText} onChange={event => setSizeText(event.target.value)}/>
        </Field>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="font-semibold">موجودی هر رنگ و سایز</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {combination.map(variant => <label key={variant.colorId + '-' + variant.size}
            className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
            <span>{item.colors.find(c => c.id === variant.colorId)?.name} / {variant.size}</span>
            <input type="number" min="0" max="1000000" required dir="ltr" className="w-24 rounded border p-2"
              value={variant.stock} onChange={event => {
                const stock = Number(event.target.value);
                setItem(prev => ({ ...prev, variants: [
                  ...prev.variants.filter(v => !(v.colorId === variant.colorId && v.size === variant.size)),
                  { colorId: variant.colorId, size: variant.size, stock }
                ] }));
              }}/>
          </label>)}
        </div>
      </fieldset>

      {error && <p role="alert" className="rounded border border-red-300 p-3 text-red-800">{error}</p>}
      {message && <p role="status" className="text-sm text-neutral-700">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || uploading} className="admin-btn admin-btn-primary">
          {busy ? 'در حال ذخیره…' : productId ? 'ذخیره تمام تغییرات محصول' : 'ایجاد محصول به‌صورت پیش‌نویس'}
        </button>
        <button type="button" onClick={done} className="admin-btn admin-btn-outline">انصراف</button>
      </div>
    </form>
  </section>;
}
