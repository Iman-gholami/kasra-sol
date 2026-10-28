'use client';

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { CirclePause, Minus, Play, Plus, ReceiptText, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { adminApi, AdminApiError, errorMessage, newClientRef } from '@/components/admin/admin-api';
import { digitsOnly, formatDateTime, formatNumber, formatToman, STORE_PAYMENT } from '@/components/admin/labels';
import { barcodeProblem, ScanField, typingElsewhere } from '@/components/admin/scan-field';
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
type Held = { id: string; note: string | null; createdAt: string; cashier: string | null; total: number; missing: number; items: Line[] };
const UNSAVED_CART = 'اقلام اسکن‌شده هنوز به‌عنوان فروش ثبت نشده‌اند (برای نگه داشتن، «تعلیق فاکتور» را بزنید). از صندوق خارج می‌شوید؟';
const timeFormat = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' });
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
  const [holds, setHolds] = useState<Held[]>([]);
  const [holdsVersion, setHoldsVersion] = useState(0);
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
  // A lookup that answers while the cashier types a note or a discount leaves the cursor where it is.
  const refocusAfterScan = useCallback(() => requestAnimationFrame(() => {
    if (!typingElsewhere(scan.current)) scan.current?.focus();
  }), []);
  // Held carts are shared by every counter device, so the list is read again whenever this window gets focus.
  useEffect(() => {
    const controller = new AbortController();
    const load = () => adminApi<{ items: Held[] }>('store-holds', { signal: controller.signal })
      .then(result => setHolds(result.items)).catch(() => { /* actions on held carts report their own errors */ });
    void load();
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.removeEventListener('focus', load); };
  }, [holdsVersion]);

  /** The cart after `sent` (code → quantity) was recorded: what was scanned while the request was in flight stays. */
  const withoutSent = (sent: { code: string; quantity: number }[]) => linesRef.current.flatMap(line => {
    const left = line.quantity - (sent.find(item => item.code === line.code)?.quantity ?? 0);
    return left > 0 ? [{ ...line, quantity: left }] : [];
  });
  const LEFT_ON_COUNTER = ' کالایی که هنگام ثبت اسکن شد، در سبد مانده است.';

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
    queue.current = queue.current.then(() => add(code)).finally(refocusAfterScan);
  }
  function setQuantity(code: string, quantity: number) {
    commit(linesRef.current.flatMap(line => line.code !== code ? [line]
      : quantity <= 0 ? [] : [{ ...line, quantity: Math.min(quantity, line.stock) }]));
    refocus();
  }
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const off = canDiscount ? Number(discount || 0) : 0;
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);

  /** Puts the cart on hold for a customer still in the fitting room and empties the counter for the next one. */
  async function park() {
    // A scan still being looked up belongs to this cart.
    await queue.current;
    const held = linesRef.current.map(line => ({ code: line.code, quantity: line.quantity }));
    if (!held.length) return [];
    await adminApi('store-holds', { method: 'POST', body: { ...(note.trim() ? { note: note.trim() } : {}), lines: held } });
    const left = withoutSent(held);
    commit(left); setNote(''); setDiscount(''); setShortage([]);
    attempt.current = { signature: '', ref: '' };
    return left;
  }
  async function holdCart() {
    if (!lines.length || busy) return;
    setBusy(true); setMessage(null);
    try {
      const left = await park();
      setMessage({ tone: 'success', text: 'فاکتور معلق شد و صندوق برای مشتری بعدی خالی است. وقتی مشتری برگشت، در «فاکتورهای معلق» ' +
        '«ادامه» را بزنید.' + (left.length ? LEFT_ON_COUNTER : '') });
    } catch (cause) { setMessage({ tone: 'error', text: errorMessage(cause) }); }
    finally { setBusy(false); setHoldsVersion(v => v + 1); refocus(); }
  }
  /** Brings a held cart back; a cart already on the counter is held first, so the two swap places. Prices and stock are
   * the current ones, and units no longer in stock are left out with a warning. */
  async function resume(held: Held) {
    if (busy) return;
    const number = formatNumber(Number(held.id));
    if (linesRef.current.length && !window.confirm('سبد فعلی معلق شود و فاکتور معلق شماره ' + number + ' باز شود؟')) return;
    setBusy(true); setMessage(null);
    try {
      await park();
      const { hold } = await adminApi<{ hold: Held }>('store-holds/' + held.id + '/resume', { method: 'POST' });
      const warnings = hold.missing ? [formatNumber(hold.missing) + ' قلم از مشخصات محصول حذف شده بود'] : [];
      const resumed = hold.items.flatMap(item => {
        const label = '«' + item.name + '» (' + item.colorName + ' / ' + item.size + ')';
        if (item.stock <= 0) { warnings.push(label + ' دیگر موجودی ندارد'); return []; }
        if (item.quantity > item.stock) {
          warnings.push(label + ' فقط ' + formatNumber(item.stock) + ' عدد موجود است');
          return [{ ...item, quantity: item.stock }];
        }
        return [item];
      });
      // Anything scanned while the cart was being swapped stays: added to the same resumed line, or after them.
      const scannedMeanwhile = linesRef.current;
      commit([...resumed.map(item => {
        const extra = scannedMeanwhile.find(line => line.code === item.code)?.quantity ?? 0;
        return extra ? { ...item, quantity: Math.min(item.quantity + extra, item.stock) } : item;
      }), ...scannedMeanwhile.filter(line => !resumed.some(item => item.code === line.code))]);
      setNote(hold.note ?? '');
      setMessage(warnings.length ? { tone: 'warning', text: 'فاکتور معلق شماره ' + number + ' باز شد، ولی ' + warnings.join('؛ ') + '.' }
        : { tone: 'success', text: 'فاکتور معلق شماره ' + number + ' باز شد.' });
    } catch (cause) { setMessage({ tone: 'error', text: errorMessage(cause) }); }
    finally { setBusy(false); setHoldsVersion(v => v + 1); refocus(); }
  }
  async function discard(held: Held) {
    if (busy || !window.confirm('فاکتور معلق شماره ' + formatNumber(Number(held.id)) + ' حذف شود؟ (موجودی تغییری نمی‌کند.)')) return;
    setBusy(true); setMessage(null);
    try { await adminApi('store-holds/' + held.id, { method: 'DELETE' }); }
    catch (cause) { setMessage({ tone: 'error', text: errorMessage(cause) }); }
    finally { setBusy(false); setHoldsVersion(v => v + 1); refocus(); }
  }

  async function record(event: FormEvent) {
    event.preventDefault();
    if (!lines.length || busy) return;
    setBusy(true); setMessage(null); setShortage([]);
    try {
      // A scan still being looked up belongs to this sale; what is scanned from here on stays for the next one.
      await queue.current;
      const sold = linesRef.current.map(line => ({ code: line.code, quantity: line.quantity }));
      if (!sold.length) return;
      if (off > linesRef.current.reduce((sum, line) => sum + line.price * line.quantity, 0)) {
        setMessage({ tone: 'error', text: 'تخفیف نمی‌تواند از جمع خرید بیشتر باشد.' });
        return;
      }
      const body = { payment, discount: off, ...(note.trim() ? { note: note.trim() } : {}), lines: sold };
      const signature = JSON.stringify(body);
      if (attempt.current.signature !== signature) attempt.current = { signature, ref: newClientRef() };
      const { sale } = await adminApi<{ sale: Sale }>('store-sales', { method: 'POST', body: { clientRef: attempt.current.ref, ...body } });
      const left = withoutSent(sold);
      commit(left); setDiscount(''); setNote(''); setPayment('card');
      attempt.current = { signature: '', ref: '' };
      setMessage({ tone: 'success', text: 'فروش شماره ' + formatNumber(Number(sale.id)) + ' به مبلغ ' + formatToman(sale.total) +
        ' ثبت شد و از موجودی فروشگاه و سایت کم شد.' + (left.length ? LEFT_ON_COUNTER : '') });
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
    {holds.length > 0 && <section className="admin-panel" aria-labelledby="held-heading">
      <div className="admin-panel-head"><div>
        <h3 id="held-heading"><CirclePause size={18} aria-hidden="true"/> فاکتورهای معلق
          <span className="admin-count">({formatNumber(holds.length)})</span></h3>
        <p>مشتری‌هایی که هنوز خریدشان تمام نشده؛ فاکتور معلق از موجودی کم نمی‌کند.</p>
      </div></div>
      <ul className="admin-held" aria-label="فاکتورهای معلق">
        {holds.map(held => <li key={held.id} className="admin-held-item">
          <div className="admin-cart-info">
            <strong>#{formatNumber(Number(held.id))}{held.note ? ' — ' + held.note : ''}</strong>
            <span>{held.items.map((item, index) => <Fragment key={item.code}>{index > 0 && '، '}{item.name} {item.colorName}
              {' / '}سایز <bdi>{item.size}</bdi> × {formatNumber(item.quantity)}</Fragment>)}</span>
            <span>{timeFormat.format(new Date(held.createdAt))}{held.cashier ? ' · ' + held.cashier : ''} · {formatToman(held.total)}</span>
          </div>
          <div className="admin-actions">
            <button type="button" className="admin-btn admin-btn-primary admin-btn-small" disabled={busy}
              aria-label={'ادامه فاکتور معلق ' + formatNumber(Number(held.id))} onClick={() => void resume(held)}>
              <Play size={13} aria-hidden="true"/> ادامه</button>
            <button type="button" className="admin-btn admin-btn-danger admin-btn-small" disabled={busy}
              aria-label={'حذف فاکتور معلق ' + formatNumber(Number(held.id))} onClick={() => void discard(held)}>
              <Trash2 size={13} aria-hidden="true"/> حذف</button>
          </div>
        </li>)}
      </ul>
    </section>}
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
            <small>برای فاکتور معلق، نشانی از مشتری بنویسید؛ مثلاً «خانم کت چرم، اتاق پرو».</small>
          </label>
          <dl className="admin-dl">
            <div><dt>جمع اقلام</dt><dd>{formatToman(subtotal)}</dd></div>
            {off > 0 && <div><dt>تخفیف</dt><dd>{formatToman(off)}</dd></div>}
            <div className="admin-dl-total"><dt>مبلغ قابل پرداخت</dt><dd>{formatToman(Math.max(0, subtotal - off))}</dd></div>
          </dl>
          <button type="submit" className="admin-btn admin-btn-primary admin-counter-submit" disabled={busy || !lines.length}>
            {busy ? 'در حال ثبت…' : 'ثبت فروش و کم کردن از موجودی'}</button>
          <button type="button" className="admin-btn admin-btn-outline" disabled={busy || !lines.length} onClick={() => void holdCart()}>
            <CirclePause size={16} aria-hidden="true"/> تعلیق فاکتور (مشتری بعدی)</button>
          {lines.length > 0 && <button type="button" className="admin-btn admin-btn-outline" disabled={busy}
            onClick={() => { if (window.confirm('همه اقلام سبد پاک شود؟')) { commit([]); setShortage([]); setMessage(null); refocus(); } }}>
            خالی کردن سبد</button>}
        </div>
      </form>
    </div>
    <TodaySales version={salesVersion} canVoid={permissions.includes('inventory:write')} voided={() => setSalesVersion(v => v + 1)}/>
  </div>;
}
