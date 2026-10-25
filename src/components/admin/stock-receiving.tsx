'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { PackagePlus, Printer, Search, Trash2 } from 'lucide-react';
import { adminApi, errorMessage, newClientRef } from '@/components/admin/admin-api';
import { digitsOnly, formatDateTime, formatNumber } from '@/components/admin/labels';
import { barcodeProblem, ScanField } from '@/components/admin/scan-field';
import { Loading, Notice, Pager } from '@/components/admin/ui';

type Line = { productId: string; name: string; colorId: string; colorName: string; size: string; quantity: string };
type Found = { id: string; name: string; stock: number; status: string };
type Variant = { id: string; color_id: string; color_name: string; size: string; stock: number };
type Receipt = { id: string; note: string | null; createdAt: string; actor: string | null; lines: number; units: number };
type ReceiptPage = { items: Receipt[]; total: number; page: number; pages: number };
const UNSAVED_RECEIPT = 'اقلام این رسید هنوز ثبت نشده و به موجودی اضافه نشده‌اند. از این صفحه خارج می‌شوید؟';
const keyOf = (line: { productId: string; colorId: string; size: string }) => line.productId + '|' + line.colorId + '|' + line.size;
const labelsFor = (query: string) => '/admin/labels?' + query;

function RecentReceipts({ version }: { version: number }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReceiptPage | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    adminApi<ReceiptPage>('stock-receipts?page=' + page, { signal: controller.signal })
      .then(result => { setData(result); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [page, version]);
  return <section className="admin-panel" aria-labelledby="receipts-heading">
    <div className="admin-panel-head"><div>
      <h2 id="receipts-heading">رسیدهای ورود کالا</h2>
      <p>برچسب هر رسید را هر وقت لازم شد دوباره چاپ کنید؛ قیمت روی برچسب، قیمت فعلی محصول است.</p>
    </div></div>
    {error && <div className="admin-panel-body"><Notice tone="error">{error}</Notice></div>}
    {!data && !error ? <div className="admin-panel-body"><Loading label="در حال دریافت رسیدها…"/></div>
      : data && (data.items.length ? <>
        <div className="admin-table-scroll">
          <table className="admin-table admin-table-cards">
            <thead><tr><th scope="col">رسید</th><th scope="col">ثبت‌کننده</th><th scope="col">اقلام</th>
              <th scope="col">یادداشت</th><th scope="col">برچسب</th></tr></thead>
            <tbody>{data.items.map(receipt => <tr key={receipt.id}>
              <td data-label="رسید"><strong>#{formatNumber(Number(receipt.id))}</strong>
                <span className="admin-sub">{formatDateTime(receipt.createdAt)}</span></td>
              <td data-label="ثبت‌کننده">{receipt.actor ?? '—'}</td>
              <td data-label="اقلام">{formatNumber(receipt.units)} عدد در {formatNumber(receipt.lines)} رنگ/سایز</td>
              <td data-label="یادداشت">{receipt.note ?? '—'}</td>
              <td data-label="برچسب"><a className="admin-btn admin-btn-outline admin-btn-small" target="_blank" rel="noopener"
                href={labelsFor('receipt=' + receipt.id)} aria-label={'چاپ برچسب‌های رسید ' + formatNumber(Number(receipt.id)) + ' (در زبانه جدید)'}>
                <Printer size={13} aria-hidden="true"/> چاپ برچسب</a></td>
            </tr>)}</tbody>
          </table>
        </div>
        <Pager page={data.page} pages={data.pages} total={data.total} unit="رسید" onPage={setPage}/>
      </> : <p className="admin-empty-inline admin-panel-body">هنوز رسیدی ثبت نشده است.</p>)}
  </section>;
}

/** Goods arriving at the shop: their units are added to the stock the website sells from, and each color/size gets a
 * barcode to print and stick on the clothes. New products are defined first in «محصولات و موجودی» (stock 0). */
export function StockReceiving({ onUnsaved }: { onUnsaved?: (question: string | null) => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [picked, setPicked] = useState<{ product: Found; variants: Variant[]; counts: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'warning'; text: string } | null>(null);
  const [done, setDone] = useState<{ id: string; units: number } | null>(null);
  const [version, setVersion] = useState(0);
  const scan = useRef<HTMLInputElement>(null);
  const linesRef = useRef(lines);
  const commit = (next: Line[]) => { linesRef.current = next; setLines(next); };
  const queue = useRef(Promise.resolve());
  const attempt = useRef({ signature: '', ref: '' });
  useEffect(() => { onUnsaved?.(lines.length ? UNSAVED_RECEIPT : null); }, [lines.length, onUnsaved]);
  useEffect(() => () => onUnsaved?.(null), [onUnsaved]);
  const refocus = useCallback(() => requestAnimationFrame(() => scan.current?.focus()), []);

  function addLines(added: Omit<Line, 'quantity'>[], quantities: number[]) {
    const next = [...linesRef.current];
    added.forEach((line, index) => {
      const at = next.findIndex(row => keyOf(row) === keyOf(line));
      if (at >= 0) next[at] = { ...next[at], quantity: String(Number(next[at].quantity || 0) + quantities[index]) };
      else next.push({ ...line, quantity: String(quantities[index]) });
    });
    commit(next);
    setDone(null);
  }
  // A label already on the shelf: one more unit of that color/size per scan.
  async function scanned(code: string) {
    const problem = barcodeProblem(code);
    if (problem) { setMessage({ tone: 'error', text: problem }); return; }
    try {
      const { item } = await adminApi<{ item: { productId: string; name: string; colorId: string; colorName: string; size: string } }>(
        'barcodes/' + code);
      addLines([{ productId: item.productId, name: item.name, colorId: item.colorId, colorName: item.colorName, size: item.size }], [1]);
      setMessage({ tone: 'success', text: '«' + item.name + '» (' + item.colorName + ' / ' + item.size + ') یک عدد به رسید اضافه شد.' });
    } catch (cause) { setMessage({ tone: 'error', text: errorMessage(cause) }); }
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setMessage(null);
    try {
      const result = await adminApi<{ items: Found[] }>('products?' + new URLSearchParams({ q: query.trim(), limit: '8' }));
      setFound(result.items);
    } catch (cause) { setMessage({ tone: 'error', text: errorMessage(cause) }); }
  }
  async function pick(product: Found) {
    setMessage(null);
    try {
      const { items } = await adminApi<{ items: Variant[] }>('products/' + product.id + '/variants');
      setPicked({ product, variants: items, counts: {} });
    } catch (cause) { setMessage({ tone: 'error', text: errorMessage(cause) }); }
  }
  function addPicked() {
    if (!picked) return;
    const chosen = picked.variants.filter(variant => Number(picked.counts[variant.id] || 0) > 0);
    if (!chosen.length) { setMessage({ tone: 'warning', text: 'تعداد رسیده را دست‌کم برای یک رنگ و سایز وارد کنید.' }); return; }
    addLines(chosen.map(variant => ({ productId: picked.product.id, name: picked.product.name, colorId: variant.color_id,
      colorName: variant.color_name, size: variant.size })), chosen.map(variant => Number(picked.counts[variant.id])));
    setMessage({ tone: 'success', text: '«' + picked.product.name + '» به رسید اضافه شد.' });
    setPicked(null); setFound(null); setQuery('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const valid = lines.filter(line => Number(line.quantity) > 0);
    if (!valid.length || busy) return;
    const body = { ...(note.trim() ? { note: note.trim() } : {}), lines: valid.map(line => ({ productId: line.productId,
      colorId: line.colorId, size: line.size, quantity: Number(line.quantity) })) };
    const signature = JSON.stringify(body);
    if (attempt.current.signature !== signature) attempt.current = { signature, ref: newClientRef() };
    setBusy(true); setMessage(null);
    try {
      const { receipt } = await adminApi<{ receipt: { id: string; items: { quantity: number }[] } }>('stock-receipts', {
        method: 'POST', body: { clientRef: attempt.current.ref, ...body } });
      commit([]); setNote('');
      attempt.current = { signature: '', ref: '' };
      setDone({ id: receipt.id, units: receipt.items.reduce((sum, item) => sum + item.quantity, 0) });
      setVersion(v => v + 1);
    } catch (cause) { setMessage({ tone: 'error', text: errorMessage(cause) }); } finally { setBusy(false); }
  }
  const units = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);

  return <div className="admin-stack">
    <div className="admin-toolbar">
      <div>
        <h2 className="admin-toolbar-heading">رسید ورود کالا</h2>
        <p className="admin-toolbar-desc">جنسی که رسید را اینجا ثبت کنید تا به موجودی سایت اضافه شود، بعد برچسب بارکد هر عدد را چاپ کنید.</p>
      </div>
    </div>
    {done && <Notice tone="success">
      رسید شماره {formatNumber(Number(done.id))} ثبت شد و {formatNumber(done.units)} عدد به موجودی اضافه شد.{' '}
      <a className="admin-link" href={labelsFor('receipt=' + done.id)} target="_blank" rel="noopener">
        <Printer size={14} aria-hidden="true"/> چاپ {formatNumber(done.units)} برچسب این رسید<span className="sr-only"> (در زبانه جدید)</span></a>
    </Notice>}
    <div className="admin-two-col">
      <section className="admin-panel" aria-labelledby="receive-pick-heading">
        <div className="admin-panel-head"><div>
          <h3 id="receive-pick-heading">افزودن کالا به رسید</h3>
          <p>کالای تازه را با نام پیدا کنید؛ برای کالایی که قبلاً برچسب خورده، برچسبش را اسکن کنید.</p>
        </div></div>
        <div className="admin-panel-body admin-stack-sm">
          <ScanField ref={scan} label="اسکن برچسب کالای موجود" hint="هر اسکن یک عدد به همان رنگ و سایز اضافه می‌کند."
            onCode={code => { queue.current = queue.current.then(() => scanned(code)).finally(refocus); }}/>
          <form role="search" className="admin-search-form" onSubmit={search}>
            <label className="admin-search-field"><span className="sr-only">جست‌وجوی محصول برای رسید</span>
              <Search size={17} aria-hidden="true"/>
              <input type="search" placeholder="نام یا کد محصول" value={query} onChange={event => setQuery(event.target.value)}/>
            </label>
            <button type="submit" className="admin-btn admin-btn-outline">جست‌وجو</button>
          </form>
          {found && !picked && (found.length ? <ul className="admin-slide-list" aria-label="نتیجه جست‌وجو">
            {found.map(product => <li key={product.id} className="admin-slide">
              <div className="admin-slide-info"><strong>{product.name}</strong>
                <span className="admin-sub">موجودی فعلی: {formatNumber(product.stock)} عدد</span></div>
              <button type="button" className="admin-btn admin-btn-outline admin-btn-small" onClick={() => void pick(product)}
                aria-label={'انتخاب ' + product.name}>انتخاب</button>
            </li>)}
          </ul> : <p className="admin-hint">محصولی پیدا نشد. محصول تازه را اول در «محصولات و موجودی» با رنگ‌ها و سایزهایش و موجودی صفر
            تعریف کنید.</p>)}
          {picked && <fieldset className="admin-fieldset">
            <legend>تعداد رسیده از «{picked.product.name}»</legend>
            {picked.variants.length ? <div className="admin-stock-grid">
              {picked.variants.map(variant => <label key={variant.id} className="admin-stock-cell">
                <span>{variant.color_name} / <bdi>{variant.size}</bdi><small className="admin-sub">
                  الان {formatNumber(variant.stock)} عدد</small></span>
                <input type="text" inputMode="numeric" dir="ltr" maxLength={5} value={picked.counts[variant.id] ?? ''}
                  aria-label={'تعداد رسیده ' + variant.color_name + ' سایز ' + variant.size}
                  onChange={event => setPicked({ ...picked, counts: { ...picked.counts, [variant.id]: digitsOnly(event.target.value) } })}/>
              </label>)}
            </div> : <p className="admin-hint">برای این محصول رنگ و سایزی تعریف نشده است.</p>}
            <div className="admin-actions">
              <button type="button" className="admin-btn admin-btn-primary" onClick={addPicked}>
                <PackagePlus size={16} aria-hidden="true"/> افزودن به رسید</button>
              <button type="button" className="admin-btn admin-btn-outline" onClick={() => setPicked(null)}>انصراف</button>
            </div>
          </fieldset>}
          <div aria-live="polite">{message && <Notice tone={message.tone}>{message.text}</Notice>}</div>
        </div>
      </section>
      <form className="admin-panel" aria-labelledby="receive-draft-heading" onSubmit={submit}>
        <div className="admin-panel-head"><h3 id="receive-draft-heading">رسید جدید {units > 0 &&
          <span className="admin-count">({formatNumber(units)} عدد)</span>}</h3></div>
        <div className="admin-panel-body admin-stack-sm">
          {lines.length ? <ul className="admin-cart" aria-label="اقلام رسید">
            {lines.map(line => <li key={keyOf(line)} className="admin-cart-line">
              <div className="admin-cart-info"><strong>{line.name}</strong>
                <span>{line.colorName} / سایز <bdi>{line.size}</bdi></span></div>
              <label className="admin-cart-count"><span className="sr-only">تعداد {line.name} {line.colorName} سایز {line.size}</span>
                <input type="text" inputMode="numeric" dir="ltr" maxLength={5} value={line.quantity}
                  onChange={event => commit(linesRef.current.map(row => keyOf(row) === keyOf(line)
                    ? { ...row, quantity: digitsOnly(event.target.value) } : row))}/>
              </label>
              <button type="button" className="admin-icon-btn admin-icon-danger" aria-label={'حذف ' + line.name + ' از رسید'}
                onClick={() => commit(linesRef.current.filter(row => keyOf(row) !== keyOf(line)))}>
                <Trash2 size={15} aria-hidden="true"/></button>
            </li>)}
          </ul> : <p className="admin-empty-inline">هنوز کالایی به رسید اضافه نشده است.</p>}
          <label className="admin-field">یادداشت رسید (اختیاری)
            <input type="text" maxLength={300} placeholder="مثلاً نام تأمین‌کننده یا شماره فاکتور خرید" value={note}
              onChange={event => setNote(event.target.value)}/>
          </label>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={busy || units <= 0}>
            {busy ? 'در حال ثبت…' : 'ثبت رسید و افزودن به موجودی'}</button>
        </div>
      </form>
    </div>
    <RecentReceipts version={version}/>
  </div>;
}
