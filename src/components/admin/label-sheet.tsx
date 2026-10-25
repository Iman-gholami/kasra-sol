'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ean13Bars } from '@/lib/ean13';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { digitsOnly, formatNumber, formatToman } from '@/components/admin/labels';
import { Loading, Notice } from '@/components/admin/ui';

type Item = { code: string; name: string; colorName: string | null; size: string; price: number | null; count: number; stock?: number };
// Sizes in millimetres. A module (the narrowest bar) of 0.25 mm is exactly 2 dots on a 203 dpi label printer and
// 0.375 mm is 3, so bars print evenly; the quiet zones (11 and 7 modules) stay blank around every symbol.
const FORMATS = {
  'roll-40x30': { name: 'لیبل‌پرینتر — برچسب ۴۰×۳۰ میلی‌متر', page: '40mm 30mm', margin: '0', module: 0.25, bars: 9, perSheet: 1 },
  'roll-50x25': { name: 'لیبل‌پرینتر — برچسب ۵۰×۲۵ میلی‌متر', page: '50mm 25mm', margin: '0', module: 0.375, bars: 8, perSheet: 1 },
  // A4 sheet of 65 labels (5 × 13, 38.1 × 21.2 mm), the common «۶۵ تایی» sheet.
  'a4-65': { name: 'برگه A4 برچسب‌دار — ۶۵ تایی (۳۸×۲۱ میلی‌متر)', page: 'A4', margin: '10.7mm 4.75mm', module: 0.25, bars: 7, perSheet: 65 }
} as const;
type Format = keyof typeof FORMATS;
const MAX_LABELS = 2000;
const PREFS = 'kasra-label-prefs';

export function BarcodeSvg({ code, module, height }: { code: string; module: number; height: number }) {
  const bars = useMemo(() => ean13Bars(code), [code]);
  return <svg className="label-bars" viewBox="0 0 95 10" preserveAspectRatio="none" shapeRendering="crispEdges"
    style={{ width: 95 * module + 'mm', height: height + 'mm', marginInline: 9 * module + 'mm' }} aria-hidden="true">
    {bars.map(([x, width]) => <rect key={x} x={x} width={width} height={10}/>)}
  </svg>;
}

function Label({ item, format, price }: { item: Item; format: Format; price: boolean }) {
  const spec = FORMATS[format];
  return <div className="label">
    {format === 'roll-40x30' && <span className="label-brand">KASRA</span>}
    <span className="label-name">{item.name}</span>
    <span className="label-meta">{item.colorName ? item.colorName + ' · ' : ''}سایز <bdi>{item.size}</bdi>
      {price && item.price !== null && format !== 'roll-40x30' && <b> · {formatToman(item.price)}</b>}</span>
    {price && item.price !== null && format === 'roll-40x30' && <span className="label-price">{formatToman(item.price)}</span>}
    <BarcodeSvg code={item.code} module={spec.module} height={spec.bars}/>
    <span className="label-code" dir="ltr">{item.code}</span>
  </div>;
}

/** Barcode labels for one goods receipt (one label per unit received) or for a product (counts chosen here), laid out
 * for a label printer roll or an A4 sheet. Printing uses the browser's print dialog at 100% scale and no margins. */
export function LabelSheet({ receipt, product }: { receipt?: string; product?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(receipt || product ? '' : 'رسید یا محصولی برای چاپ برچسب انتخاب نشده است.');
  const [format, setFormat] = useState<Format>('roll-40x30');
  const [price, setPrice] = useState(true);
  const [skip, setSkip] = useState('');
  // The last label type and price choice, applied when the labels arrive (nothing format-dependent shows before).
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS) ?? '{}') as { format?: string; price?: boolean };
      if (saved.format && saved.format in FORMATS) setFormat(saved.format as Format);
      if (typeof saved.price === 'boolean') setPrice(saved.price);
    } catch { /* preferences are optional */ }
  }
  function remember(next: { format?: Format; price?: boolean }) {
    try { localStorage.setItem(PREFS, JSON.stringify({ format, price, ...next })); } catch { /* preferences are optional */ }
  }
  useEffect(() => {
    const expired = () => router.replace('/admin/login?expired=1');
    window.addEventListener('kasra-admin-unauthorized', expired);
    return () => window.removeEventListener('kasra-admin-unauthorized', expired);
  }, [router]);
  useEffect(() => {
    const controller = new AbortController();
    const load = receipt
      ? adminApi<{ receipt: { id: string; items: (Omit<Item, 'count'> & { quantity: number })[] } }>('stock-receipts/' + receipt,
        { signal: controller.signal }).then(({ receipt: found }) => {
        setTitle('رسید ورود کالای شماره ' + formatNumber(Number(found.id)));
        return found.items.map(item => ({ ...item, count: item.quantity }));
      })
      : product ? adminApi<{ product: { name: string; price: number }; items: (Omit<Item, 'count' | 'name' | 'price'> & { stock: number })[] }>(
        'products/' + product + '/barcodes', { method: 'POST', signal: controller.signal }).then(result => {
        setTitle(result.product.name);
        return result.items.map(item => ({ ...item, name: result.product.name, price: result.product.price, count: 1 }));
      }) : null;
    load?.then(found => { restore(); setItems(found); }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [receipt, product]);

  const spec = FORMATS[format];
  const labels = useMemo(() => (items ?? []).flatMap(item => Array.from({ length: Math.max(0, item.count) }, () => item)), [items]);
  const offset = spec.perSheet > 1 ? Math.min(Number(skip || 0), spec.perSheet - 1) : 0;
  const slots: (Item | null)[] = [...Array.from({ length: offset }, () => null), ...labels.slice(0, MAX_LABELS)];
  const sheets = Array.from({ length: Math.ceil(slots.length / spec.perSheet) }, (_, i) => slots.slice(i * spec.perSheet, (i + 1) * spec.perSheet));
  const setCount = (code: string, count: number) =>
    setItems(current => current?.map(item => item.code === code ? { ...item, count: Math.min(999, count) } : item) ?? null);

  return <div className="admin-labels" data-format={format}>
    <style>{'@page { size: ' + spec.page + '; margin: ' + spec.margin + '; }'}</style>
    <div className="label-tools">
      <div className="admin-toolbar">
        <div>
          <h1 className="admin-toolbar-heading">چاپ برچسب بارکد</h1>
          <p className="admin-toolbar-desc">{title || (product ? 'محصول' : 'رسید ورود کالا')}</p>
        </div>
        <a className="admin-btn admin-btn-outline admin-btn-small" href={receipt ? '/admin?tab=receiving' : '/admin?tab=products'}>
          <ArrowRight size={15} aria-hidden="true"/> بازگشت به پنل</a>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!items && !error && <Loading label="در حال آماده‌کردن برچسب‌ها…"/>}
      {items && <section className="admin-panel">
        <div className="admin-panel-body admin-stack-sm">
          <div className="admin-form-grid">
            <label className="admin-field">نوع برچسب
              <select value={format} onChange={event => { const next = event.target.value as Format; setFormat(next); remember({ format: next }); }}>
                {(Object.keys(FORMATS) as Format[]).map(id => <option key={id} value={id}>{FORMATS[id].name}</option>)}
              </select>
            </label>
            {spec.perSheet > 1 && <label className="admin-field">چند خانه اول برگه خالی بماند؟
              <input type="text" inputMode="numeric" dir="ltr" maxLength={2} value={skip} onChange={event => setSkip(digitsOnly(event.target.value))}/>
              <small>برای برگه‌ای که قبلاً چند برچسبش استفاده شده است.</small>
            </label>}
          </div>
          <label className="admin-check"><input type="checkbox" checked={price}
            onChange={event => { setPrice(event.target.checked); remember({ price: event.target.checked }); }}/>
            <span>قیمت روی برچسب چاپ شود<small>در صندوق همیشه قیمت فعلی سایت حساب می‌شود، نه عدد روی برچسب.</small></span></label>
          <div className="admin-table-scroll">
            <table className="admin-table admin-table-compact">
              <thead><tr><th scope="col">کالا</th><th scope="col">بارکد</th><th scope="col">تعداد برچسب</th></tr></thead>
              <tbody>{items.map(item => <tr key={item.code}>
                <td>{item.name}<span className="admin-sub">{item.colorName} / سایز <bdi>{item.size}</bdi>
                  {item.stock !== undefined && ' · موجودی ' + formatNumber(item.stock)}</span></td>
                <td><bdi dir="ltr" className="admin-mono">{item.code}</bdi></td>
                <td><input className="label-count" type="text" inputMode="numeric" dir="ltr" maxLength={3} value={String(item.count)}
                  aria-label={'تعداد برچسب ' + item.colorName + ' سایز ' + item.size}
                  onChange={event => setCount(item.code, Number(digitsOnly(event.target.value) || 0))}/></td>
              </tr>)}</tbody>
            </table>
          </div>
          {product && <div className="admin-actions">
            <button type="button" className="admin-btn admin-btn-outline admin-btn-small"
              onClick={() => setItems(items.map(item => ({ ...item, count: item.stock ?? 0 })))}>هر کدام به تعداد موجودی</button>
            <button type="button" className="admin-btn admin-btn-outline admin-btn-small"
              onClick={() => setItems(items.map(item => ({ ...item, count: 1 })))}>هر کدام یک برچسب</button>
          </div>}
          {labels.length > MAX_LABELS && <Notice tone="warning">در هر بار چاپ حداکثر {formatNumber(MAX_LABELS)} برچسب آماده می‌شود؛
            بقیه را در نوبت بعد چاپ کنید.</Notice>}
          <Notice tone="info">در پنجره چاپ: چاپگر برچسب را انتخاب کنید، «حاشیه» را <b>هیچ (None)</b> و «مقیاس» را <b>۱۰۰٪</b> بگذارید.
            {spec.perSheet === 1 && ' اندازه برچسب در تنظیمات درایور چاپگر هم باید همین اندازه باشد.'}</Notice>
          <button type="button" className="admin-btn admin-btn-primary admin-self-start" disabled={!labels.length}
            onClick={() => window.print()}><Printer size={16} aria-hidden="true"/> چاپ {formatNumber(Math.min(labels.length, MAX_LABELS))} برچسب</button>
        </div>
      </section>}
    </div>
    {items && <div className="label-preview" aria-label="پیش‌نمایش برچسب‌ها">
      {sheets.map((sheet, index) => <div className="label-sheet" key={index}>
        {sheet.map((item, slot) => item ? <Label key={slot} item={item} format={format} price={price}/>
          : <div className="label label-blank" key={slot}/>)}
      </div>)}
    </div>}
  </div>;
}
