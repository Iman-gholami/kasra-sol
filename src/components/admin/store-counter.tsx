'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Minus, Plus, ReceiptText, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { adminApi, AdminApiError, errorMessage, newClientRef } from '@/components/admin/admin-api';
import { digitsOnly, formatDateTime, formatNumber, formatToman, STORE_PAYMENT } from '@/components/admin/labels';
import { barcodeProblem, ScanField } from '@/components/admin/scan-field';
import { Badge, Loading, Notice } from '@/components/admin/ui';

type Item = { code: string; productId: string; name: string; colorName: string; size: string; price: number; stock: number };
type Line = Item & { quantity: number };
type Short = { code: string; name: string; colorName: string; size: string; requested: number; available: number };
type Sale = {
  id: string; payment: string; subtotal: number; discount: number; total: number; note: string | null; createdAt: string;
  voidedAt: string | null; cashier: string | null; voidedBy: string | null;
  items: { code: string; name: string; colorName: string | null; size: string; quantity: number; unitPrice: number }[];
};
type Day = { date: string; summary: { sales: number; units: number; total: string; cash: string; card: string; transfer: string };
  items: Sale[] };
const UNSAVED_CART = 'اقلام اسکن‌شده هنوز به‌عنوان فروش ثبت نشده‌اند. از صندوق خارج می‌شوید؟';
const PAYMENTS = ['card', 'cash', 'transfer'] as const;

function TodaySales({ version, canVoid, voided }: { version: number; canVoid: boolean; voided: () => void }) {
  const [day, setDay] = useState<Day | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    adminApi<Day>('store-sales', { signal: controller.signal })
      .then(result => { setDay(result); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [version, reload]);
  async function cancel(sale: Sale) {
    const units = sale.items.reduce((sum, item) => sum + item.quantity, 0);
    if (!window.confirm('فروش شماره ' + formatNumber(Number(sale.id)) + ' باطل شود؟\n' + formatNumber(units) +
      ' عدد کالا به موجودی فروشگاه و سایت برمی‌گردد. این کار قابل بازگشت نیست.')) return;
    setBusy(sale.id); setNotice(''); setError('');
    try {
      const result = await adminApi<{ restocked: number }>('store-sales/' + sale.id + '/void', { method: 'POST', body: {} });
      setNotice('فروش شماره ' + formatNumber(Number(sale.id)) + ' باطل شد و ' + formatNumber(result.restocked) + ' عدد به موجودی برگشت.');
      voided();
    } catch (cause) { setError(errorMessage(cause)); setReload(v => v + 1); } finally { setBusy(null); }
  }
  const summary = day?.summary;
  return <section className="admin-panel" aria-labelledby="today-sales-heading">
    <div className="admin-panel-head">
      <div>
        <h2 id="today-sales-heading"><ReceiptText size={18} aria-hidden="true"/> فروش حضوری امروز</h2>
        <p>فاکتورهای باطل‌شده در جمع‌ها حساب نمی‌شوند.</p>
      </div>
      <button type="button" className="admin-btn admin-btn-outline admin-btn-small" onClick={() => setReload(v => v + 1)}>
        <RefreshCw size={14} aria-hidden="true"/> به‌روزرسانی</button>
    </div>
    <div className="admin-panel-body admin-stack-sm">
      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      {!day && !error && <Loading label="در حال دریافت فروش امروز…"/>}
      {summary && <div className="admin-counter-totals">
        <p><span>فاکتور</span><strong>{formatNumber(summary.sales)}</strong></p>
        <p><span>کالای فروخته‌شده</span><strong>{formatNumber(summary.units)}</strong></p>
        <p><span>جمع فروش</span><strong>{formatToman(summary.total)}</strong></p>
        {PAYMENTS.map(method => <p key={method}><span>{STORE_PAYMENT[method]}</span><strong>{formatToman(summary[method])}</strong></p>)}
      </div>}
    </div>
    {day && (day.items.length ? <div className="admin-table-scroll">
      <table className="admin-table admin-table-cards">
        <thead><tr>
          <th scope="col">فاکتور</th><th scope="col">اقلام</th><th scope="col">پرداخت</th><th scope="col">مبلغ</th>
          <th scope="col">صندوقدار</th><th scope="col">وضعیت</th>
        </tr></thead>
        <tbody>
          {day.items.map(sale => <tr key={sale.id}>
            <td data-label="فاکتور"><strong>#{formatNumber(Number(sale.id))}</strong>
              <span className="admin-sub">{formatDateTime(sale.createdAt)}</span></td>
            <td data-label="اقلام"><ul className="admin-plain-list">
              {sale.items.map(item => <li key={item.code}>{item.name} — {item.colorName ?? ''} / <bdi>{item.size}</bdi>
                {' × '}{formatNumber(item.quantity)}</li>)}
            </ul>{sale.note && <span className="admin-sub">یادداشت: {sale.note}</span>}</td>
            <td data-label="پرداخت">{STORE_PAYMENT[sale.payment] ?? sale.payment}</td>
            <td data-label="مبلغ"><span className="admin-nowrap">{formatToman(sale.total)}</span>
              {sale.discount > 0 && <span className="admin-sub">تخفیف: {formatToman(sale.discount)}</span>}</td>
            <td data-label="صندوقدار">{sale.cashier ?? '—'}</td>
            <td data-label="وضعیت">
              {sale.voidedAt ? <><Badge tone="neutral">باطل‌شده</Badge>
                {sale.voidedBy && <span className="admin-sub">توسط {sale.voidedBy}</span>}</>
                : <div className="admin-table-actions">
                  <Badge tone="success">ثبت‌شده</Badge>
                  {canVoid && <button type="button" className="admin-btn admin-btn-danger admin-btn-small" disabled={busy !== null}
                    aria-label={'ابطال فروش شماره ' + formatNumber(Number(sale.id))} onClick={() => void cancel(sale)}>
                    <Undo2 size={13} aria-hidden="true"/> ابطال / مرجوعی</button>}
                </div>}
            </td>
          </tr>)}
        </tbody>
      </table>
    </div> : <p className="admin-empty-inline admin-panel-body">امروز هنوز فروش حضوری ثبت نشده است.</p>)}
  </section>;
}

/** The shop counter: scan labels into a cart and record the sale, which takes the units from the same stock the website
 * sells from. Prices always come from the catalog; the API checks stock again when the sale is recorded. */
export function StoreCounter({ permissions, onUnsaved }: { permissions: string[]; onUnsaved?: (question: string | null) => void }) {
  const canDiscount = permissions.includes('products:price');
  const [lines, setLines] = useState<Line[]>([]);
  const [payment, setPayment] = useState<(typeof PAYMENTS)[number]>('card');
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'warning'; text: string } | null>(null);
  const [shortage, setShortage] = useState<Short[]>([]);
  const [salesVersion, setSalesVersion] = useState(0);
  const scan = useRef<HTMLInputElement>(null);
  // Scans arrive faster than lookups answer; they are handled one after another so a repeated label adds up.
  const queue = useRef(Promise.resolve());
  // The cart as of the last change, for scans handled before React renders it.
  const linesRef = useRef(lines);
  const commit = (next: Line[]) => { linesRef.current = next; setLines(next); };
  // The same cart submitted again (after a lost answer) reuses its reference, so it is recorded once.
  const attempt = useRef({ signature: '', ref: '' });
  useEffect(() => { onUnsaved?.(lines.length ? UNSAVED_CART : null); }, [lines.length, onUnsaved]);
  useEffect(() => () => onUnsaved?.(null), [onUnsaved]);
  const refocus = useCallback(() => requestAnimationFrame(() => scan.current?.focus()), []);

  async function add(code: string) {
    const problem = barcodeProblem(code);
    if (problem) { setMessage({ tone: 'error', text: problem }); return; }
    const existing = linesRef.current.find(line => line.code === code);
    if (existing) {
      if (existing.quantity + 1 > existing.stock) {
        setMessage({ tone: 'warning', text: 'موجودی سیستم برای «' + existing.name + '» (' + existing.colorName + ' / ' + existing.size +
          ') فقط ' + formatNumber(existing.stock) + ' عدد است.' });
        return;
      }
      commit(linesRef.current.map(line => line.code === code ? { ...line, quantity: line.quantity + 1 } : line));
      setMessage({ tone: 'success', text: '«' + existing.name + '» یک عدد دیگر اضافه شد.' });
      return;
    }
    try {
      const { item } = await adminApi<{ item: Item }>('barcodes/' + code);
      if (item.stock <= 0) {
        setMessage({ tone: 'warning', text: '«' + item.name + '» (' + item.colorName + ' / ' + item.size + ') در سیستم موجودی ندارد. ' +
          'احتمالاً آخرین عدد آن در سایت سفارش داده شده (سفارش‌های باز را ببینید) یا ورود این کالا هنوز ثبت نشده است.' });
        return;
      }
      if (linesRef.current.some(line => line.code === code)) return void add(code);
      commit([...linesRef.current, { ...item, quantity: 1 }]);
      setMessage({ tone: 'success', text: '«' + item.name + '» (' + item.colorName + ' / ' + item.size + ') اضافه شد.' });
    } catch (cause) { setMessage({ tone: 'error', text: errorMessage(cause) }); }
  }
  function scanned(code: string) {
    queue.current = queue.current.then(() => add(code)).finally(refocus);
  }
  function setQuantity(code: string, quantity: number) {
    commit(linesRef.current.flatMap(line => line.code !== code ? [line]
      : quantity <= 0 ? [] : [{ ...line, quantity: Math.min(quantity, line.stock) }]));
    refocus();
  }
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const off = canDiscount ? Number(discount || 0) : 0;
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);

  async function record(event: FormEvent) {
    event.preventDefault();
    if (!lines.length || busy) return;
    if (off > subtotal) { setMessage({ tone: 'error', text: 'تخفیف نمی‌تواند از جمع خرید بیشتر باشد.' }); return; }
    const body = { payment, discount: off, ...(note.trim() ? { note: note.trim() } : {}),
      lines: lines.map(line => ({ code: line.code, quantity: line.quantity })) };
    const signature = JSON.stringify(body);
    if (attempt.current.signature !== signature) attempt.current = { signature, ref: newClientRef() };
    setBusy(true); setMessage(null); setShortage([]);
    try {
      const { sale } = await adminApi<{ sale: Sale }>('store-sales', { method: 'POST', body: { clientRef: attempt.current.ref, ...body } });
      commit([]); setDiscount(''); setNote(''); setPayment('card');
      attempt.current = { signature: '', ref: '' };
      setMessage({ tone: 'success', text: 'فروش شماره ' + formatNumber(Number(sale.id)) + ' به مبلغ ' + formatToman(sale.total) +
        ' ثبت شد و از موجودی فروشگاه و سایت کم شد.' });
      setSalesVersion(v => v + 1);
    } catch (cause) {
      if (cause instanceof AdminApiError && cause.code === 'insufficient_stock') {
        const items = (cause.data.items ?? []) as Short[];
        setShortage(items);
        commit(linesRef.current.map(line => {
          const short = items.find(item => item.code === line.code);
          return short ? { ...line, stock: short.available } : line;
        }));
      }
      if (cause instanceof AdminApiError && cause.code === 'backend_unavailable') {
        // The sale may have been recorded before the connection dropped: the list shows it if so.
        setSalesVersion(v => v + 1);
        setMessage({ tone: 'error', text: errorMessage(cause) + ' پیش از ثبت دوباره، «فروش حضوری امروز» را نگاه کنید؛ ' +
          'ثبت دوباره همین سبد بدون تغییر، کالا را دوباره از موجودی کم نمی‌کند.' });
      } else setMessage({ tone: 'error', text: errorMessage(cause) });
    } finally { setBusy(false); refocus(); }
  }

  return <div className="admin-stack">
    <div className="admin-toolbar">
      <div>
        <h2 className="admin-toolbar-heading">فروش با بارکد</h2>
        <p className="admin-toolbar-desc">برچسب هر کالا را اسکن کنید؛ با ثبت فروش، همان لحظه از موجودی سایت هم کم می‌شود.</p>
      </div>
    </div>
    <div className="admin-counter">
      <section className="admin-panel" aria-labelledby="counter-cart-heading">
        <div className="admin-panel-head"><h3 id="counter-cart-heading">سبد خرید مشتری {units > 0 &&
          <span className="admin-count">({formatNumber(units)} عدد)</span>}</h3></div>
        <div className="admin-panel-body admin-stack-sm">
          <ScanField ref={scan} label="اسکن بارکد کالا" onCode={scanned}
            hint="بارکدخوان را روی برچسب بگیرید، یا ۱۳ رقم زیر بارکد را بنویسید و Enter بزنید."/>
          <div aria-live="polite">{message && <Notice tone={message.tone}>{message.text}</Notice>}</div>
          {shortage.length > 0 && <Notice tone="warning">
            <strong>موجودی سیستم کمتر از تعداد سبد است:</strong>
            <ul className="admin-plain-list">{shortage.map(item => <li key={item.code}>{item.name} — {item.colorName} / <bdi>{item.size}</bdi>:
              {' '}{formatNumber(item.requested)} عدد در سبد، موجودی {formatNumber(item.available)}</li>)}</ul>
            اگر کالا جلوی شماست ولی سیستم موجودی ندارد، یا برای سفارشی در سایت کنار گذاشته شده (سفارش‌های باز را ببینید) یا ورود آن ثبت
            نشده است.
          </Notice>}
          {lines.length ? <ul className="admin-cart" aria-label="اقلام سبد">
            {lines.map(line => <li key={line.code} className="admin-cart-line">
              <div className="admin-cart-info">
                <strong>{line.name}</strong>
                <span>{line.colorName} / سایز <bdi>{line.size}</bdi> · <bdi dir="ltr" className="admin-mono">{line.code}</bdi></span>
                <span>{formatToman(line.price)} · موجودی سیستم {formatNumber(line.stock)}</span>
              </div>
              <div className="admin-cart-qty">
                <button type="button" className="admin-icon-btn" aria-label={'یکی کمتر از ' + line.name}
                  onClick={() => setQuantity(line.code, line.quantity - 1)}><Minus size={15} aria-hidden="true"/></button>
                <output aria-label={'تعداد ' + line.name}>{formatNumber(line.quantity)}</output>
                <button type="button" className="admin-icon-btn" aria-label={'یکی بیشتر از ' + line.name} disabled={line.quantity >= line.stock}
                  onClick={() => setQuantity(line.code, line.quantity + 1)}><Plus size={15} aria-hidden="true"/></button>
              </div>
              <strong className="admin-cart-total">{formatToman(line.price * line.quantity)}</strong>
              <button type="button" className="admin-icon-btn admin-icon-danger" aria-label={'حذف ' + line.name + ' از سبد'}
                onClick={() => setQuantity(line.code, 0)}><Trash2 size={15} aria-hidden="true"/></button>
            </li>)}
          </ul> : <p className="admin-empty-inline">سبد خالی است؛ اولین کالا را اسکن کنید.</p>}
        </div>
      </section>
      <form className="admin-panel admin-counter-pay" aria-labelledby="counter-pay-heading" onSubmit={record}>
        <div className="admin-panel-head"><h3 id="counter-pay-heading">پرداخت و ثبت</h3></div>
        <div className="admin-panel-body admin-stack-sm">
          <fieldset className="admin-segmented">
            <legend>روش پرداخت</legend>
            {PAYMENTS.map(method => <label key={method}>
              <input type="radio" name="payment" value={method} checked={payment === method} onChange={() => setPayment(method)}/>
              <span>{STORE_PAYMENT[method]}</span>
            </label>)}
          </fieldset>
          {canDiscount && <label className="admin-field">تخفیف (تومان)
            <input type="text" inputMode="numeric" dir="ltr" maxLength={10} value={discount}
              onChange={event => setDiscount(digitsOnly(event.target.value))}/>
          </label>}
          <label className="admin-field">یادداشت (اختیاری)
            <input type="text" maxLength={300} value={note} onChange={event => setNote(event.target.value)}/>
          </label>
          <dl className="admin-dl">
            <div><dt>جمع اقلام</dt><dd>{formatToman(subtotal)}</dd></div>
            {off > 0 && <div><dt>تخفیف</dt><dd>{formatToman(off)}</dd></div>}
            <div className="admin-dl-total"><dt>مبلغ قابل پرداخت</dt><dd>{formatToman(Math.max(0, subtotal - off))}</dd></div>
          </dl>
          <button type="submit" className="admin-btn admin-btn-primary admin-counter-submit" disabled={busy || !lines.length}>
            {busy ? 'در حال ثبت…' : 'ثبت فروش و کم کردن از موجودی'}</button>
          {lines.length > 0 && <button type="button" className="admin-btn admin-btn-outline" disabled={busy}
            onClick={() => { if (window.confirm('همه اقلام سبد پاک شود؟')) { commit([]); setShortage([]); setMessage(null); refocus(); } }}>
            خالی کردن سبد</button>}
        </div>
      </form>
    </div>
    <TodaySales version={salesVersion} canVoid={permissions.includes('inventory:write')} voided={() => setSalesVersion(v => v + 1)}/>
  </div>;
}
