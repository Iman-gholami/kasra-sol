'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ClipboardList, Phone, RefreshCw, Search } from 'lucide-react';
import { adminApi, AdminApiError, errorMessage } from '@/components/admin/admin-api';
import {
  formatDateTime, formatNumber, formatToman, ORDER_STATUS, PAYMENT_METHOD, paymentState, SHIPPING_METHOD,
  statusLabel, statusTone, TRANSITION_ACTIONS
} from '@/components/admin/labels';
import { Badge, Loading, Notice, Pager } from '@/components/admin/ui';

type OrderRow = {
  id: string; status: string; payment: string; shipping: string; total: number; createdAt: string;
  customer: string | null; province: string | null; city: string | null; units: number; nextStatuses: string[];
};
type OrderList = { items: OrderRow[]; total: number; page: number; pages: number };
type OrderDetail = {
  id: string; status: string; payment: string; shipping: string; code: string | null;
  subtotal: number; discount: number; shippingCost: number; total: number; createdAt: string;
  address: { name: string; mobile: string; province: string; city: string; address: string; postal: string; notes?: string };
  items: { productId: string; name: string; colorId: string; colorName: string | null; size: string;
    quantity: number; unitPrice: number; productActive: boolean | null }[];
  history: { from: string | null; to: string; note: string | null; createdAt: string; actor: string | null }[];
  nextStatuses: string[];
};
const FILTERS = [['open', 'سفارش‌های باز'], ['all', 'همه سفارش‌ها'],
  ...Object.entries(ORDER_STATUS).map(([value, { label }]) => [value, label])] as const;
const shortId = (id: string) => id.slice(0, 8).toUpperCase();

function confirmText(order: { payment: string }, next: string) {
  if (next === 'delivered') return 'تحویل سفارش به مشتری ثبت شود؟\nاین کار به معنی ثبت دریافت وجه نیست.';
  if (next === 'cancelled') return order.payment === 'cod'
    ? 'این سفارش لغو شود؟\nموجودی اقلام آن به انبار برمی‌گردد و این کار قابل بازگشت نیست.'
    : 'سفارش پرداخت‌نشده لغو شود؟ این کار قابل بازگشت نیست.';
  return TRANSITION_ACTIONS[next] + ' برای این سفارش ثبت شود؟';
}

function OrderDetailView({ id, canFulfill, onBack }: { id: string; canFulfill: boolean; onBack: () => void }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fetchOrder = useCallback((signal?: AbortSignal) =>
    adminApi<{ item: OrderDetail }>('orders/' + id, { signal }).then(result => result.item), [id]);
  const load = async () => {
    try { setOrder(await fetchOrder()); } catch (cause) { setError(errorMessage(cause)); }
  };
  useEffect(() => {
    const controller = new AbortController();
    fetchOrder(controller.signal).then(setOrder)
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [fetchOrder]);

  async function move(next: string) {
    if (!order || !window.confirm(confirmText(order, next))) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await adminApi<{ restocked: number }>('orders/' + id + '/status', {
        method: 'PATCH', body: { status: next, ...(note.trim() ? { note: note.trim() } : {}) } });
      setNote('');
      setNotice('وضعیت سفارش به «' + statusLabel(next) + '» تغییر کرد.' +
        (result.restocked ? ' ' + formatNumber(result.restocked) + ' عدد به موجودی برگشت.' : ''));
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof AdminApiError && cause.status === 409) await load();
    } finally { setBusy(false); }
  }

  if (!order) return <div className="admin-stack">
    <button type="button" className="admin-btn admin-btn-outline admin-btn-small admin-back" onClick={onBack}>
      <ArrowRight size={15} aria-hidden="true"/> بازگشت به سفارش‌ها</button>
    {error ? <Notice tone="error">{error}</Notice> : <Loading label="در حال دریافت جزئیات سفارش…"/>}
  </div>;
  const payment = paymentState(order.payment, order.status);
  return <div className="admin-stack" data-testid="order-detail">
    <button type="button" className="admin-btn admin-btn-outline admin-btn-small admin-back" onClick={onBack}>
      <ArrowRight size={15} aria-hidden="true"/> بازگشت به سفارش‌ها</button>
    <section className="admin-panel" aria-labelledby="order-title">
      <div className="admin-panel-head">
        <div>
          <h2 id="order-title">سفارش <bdi dir="ltr">#{shortId(order.id)}</bdi></h2>
          <p>ثبت‌شده در {formatDateTime(order.createdAt)} · <bdi dir="ltr" className="admin-mono">{order.id}</bdi></p>
        </div>
        <div className="admin-badges">
          <Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge>
          <Badge tone={payment.tone}>{payment.label}</Badge>
        </div>
      </div>
      <div className="admin-panel-body admin-stack">
        {order.payment === 'online' && order.status === 'pending_payment' && <Notice tone="warning">
          این سفارش اینترنتی هنوز پرداخت نشده است. تا اتصال درگاه و تأیید واقعی پرداخت، نباید آماده یا ارسال شود؛
          فقط می‌توانید آن را لغو کنید. برای این سفارش موجودی رزرو نشده است.</Notice>}
        {order.payment === 'cod' && order.status === 'delivered' && <Notice tone="info">
          تحویل ثبت شده است، اما دریافت وجه در سامانه ثبت و تأیید نمی‌شود و این مبلغ درآمد قطعی نیست.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="success">{notice}</Notice>}
        <div className="admin-detail-grid">
          <section aria-labelledby="customer-title" className="admin-subcard">
            <h3 id="customer-title">مشتری و نشانی تحویل</h3>
            <dl className="admin-dl">
              <div><dt>نام</dt><dd>{order.address.name}</dd></div>
              <div><dt>موبایل</dt><dd><a href={'tel:' + order.address.mobile} className="admin-link">
                <Phone size={14} aria-hidden="true"/><bdi dir="ltr">{order.address.mobile}</bdi></a></dd></div>
              <div><dt>استان و شهر</dt><dd>{order.address.province}، {order.address.city}</dd></div>
              <div><dt>نشانی</dt><dd>{order.address.address}</dd></div>
              <div><dt>کد پستی</dt><dd><bdi dir="ltr">{order.address.postal}</bdi></dd></div>
              {order.address.notes && <div><dt>توضیحات مشتری</dt><dd>{order.address.notes}</dd></div>}
            </dl>
          </section>
          <section aria-labelledby="payment-title" className="admin-subcard">
            <h3 id="payment-title">ارسال و مبلغ</h3>
            <dl className="admin-dl">
              <div><dt>روش ارسال</dt><dd>{SHIPPING_METHOD[order.shipping] ?? order.shipping}</dd></div>
              <div><dt>روش پرداخت</dt><dd>{PAYMENT_METHOD[order.payment] ?? order.payment}</dd></div>
              <div><dt>جمع کالاها</dt><dd>{formatToman(order.subtotal)}</dd></div>
              <div><dt>تخفیف{order.code ? ' (' + order.code + ')' : ''}</dt><dd>{formatToman(order.discount)}</dd></div>
              <div><dt>هزینه ارسال</dt><dd>{order.shippingCost ? formatToman(order.shippingCost) : 'رایگان'}</dd></div>
              <div className="admin-dl-total"><dt>مبلغ نهایی</dt><dd>{formatToman(order.total)}</dd></div>
            </dl>
          </section>
        </div>
        <section aria-labelledby="items-title">
          <h3 id="items-title" className="admin-section-title">اقلام سفارش</h3>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th scope="col">کالا</th><th scope="col">رنگ</th><th scope="col">سایز</th>
                <th scope="col">تعداد</th><th scope="col">قیمت واحد</th><th scope="col">جمع</th></tr></thead>
              <tbody>{order.items.map(item => <tr key={item.productId + item.colorId + item.size}>
                <td data-label="کالا"><strong>{item.name}</strong>
                  {item.productActive === false && <span className="admin-muted-tag">آرشیوشده</span>}
                  <span className="admin-sub" dir="ltr">{item.productId}</span></td>
                <td data-label="رنگ">{item.colorName ?? item.colorId}</td>
                <td data-label="سایز"><bdi>{item.size}</bdi></td>
                <td data-label="تعداد">{formatNumber(item.quantity)}</td>
                <td data-label="قیمت واحد">{formatToman(item.unitPrice)}</td>
                <td data-label="جمع">{formatToman(item.unitPrice * item.quantity)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
        <section aria-labelledby="history-title">
          <h3 id="history-title" className="admin-section-title">تاریخچه وضعیت</h3>
          <ol className="admin-timeline">
            {order.history.map((entry, index) => <li key={index}>
              <strong>{statusLabel(entry.to)}</strong>
              <span>{formatDateTime(entry.createdAt)} · {entry.from === null ? 'ثبت توسط مشتری' : entry.actor ?? 'نامشخص'}</span>
              {entry.note && <q>{entry.note}</q>}
            </li>)}
          </ol>
        </section>
        {canFulfill && order.nextStatuses.length > 0 && <section aria-labelledby="actions-title" className="admin-subcard">
          <h3 id="actions-title">اقدام بعدی</h3>
          <label className="admin-field">یادداشت داخلی (اختیاری، مثلاً دلیل لغو یا کد رهگیری)
            <input value={note} maxLength={300} onChange={event => setNote(event.target.value)}/>
          </label>
          <div className="admin-actions">
            {order.nextStatuses.map(next => <button key={next} type="button" disabled={busy}
              className={'admin-btn ' + (next === 'cancelled' ? 'admin-btn-danger' : 'admin-btn-primary')}
              onClick={() => void move(next)}>{busy ? 'در حال ثبت…' : TRANSITION_ACTIONS[next]}</button>)}
          </div>
        </section>}
      </div>
    </section>
  </div>;
}

export function OrderManager({ canFulfill }: { canFulfill: boolean }) {
  const [status, setStatus] = useState('open');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrderList | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (selected) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ status, page: String(page), limit: '20', ...(search ? { q: search } : {}) });
    adminApi<OrderList>('orders?' + params, { signal: controller.signal })
      .then(result => { setData(result); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, search, page, selected, version]);

  if (selected) return <OrderDetailView id={selected} canFulfill={canFulfill}
    onBack={() => { setSelected(null); setLoading(true); }}/>;
  function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setPage(1); setSearch(query.trim());
  }
  return <div className="admin-stack">
    <Notice tone="info">سفارش اینترنتی «در انتظار پرداخت» پرداخت‌نشده است و تا اتصال درگاه واقعی قابل تأیید یا ارسال نیست.
      سفارش‌های پرداخت در محل پس از ثبت، مرحله‌به‌مرحله آماده، ارسال و تحویل می‌شوند.</Notice>
    <section className="admin-panel" aria-labelledby="orders-heading">
      <div className="admin-panel-head">
        <div><h2 id="orders-heading">فهرست سفارش‌ها</h2><p>جدیدترین سفارش‌ها در ابتدا</p></div>
        <div className="admin-toolbar-controls">
          <form role="search" onSubmit={submit} className="admin-search-form">
            <label className="admin-search-field"><span className="sr-only">جست‌وجوی سفارش</span>
              <Search size={17} aria-hidden="true"/>
              <input type="search" value={query} onChange={event => setQuery(event.target.value)}
                placeholder="شماره موبایل، نام یا کد سفارش"/>
            </label>
            <button type="submit" className="admin-btn admin-btn-outline">جست‌وجو</button>
          </form>
          <label className="admin-inline-field"><span className="sr-only">فیلتر وضعیت سفارش</span>
            <select value={status} onChange={event => { setLoading(true); setPage(1); setStatus(event.target.value); }}>
              {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="button" className="admin-btn admin-btn-outline" onClick={() => { setLoading(true); setVersion(v => v + 1); }}>
            <RefreshCw size={15} aria-hidden="true"/> تازه‌سازی</button>
        </div>
      </div>
      {error && <div className="admin-panel-body"><Notice tone="error">{error}</Notice></div>}
      {loading ? <div className="admin-panel-body"><Loading label="در حال دریافت سفارش‌ها…"/></div>
        : data && data.items.length ? <>
          <div className="admin-table-scroll">
            <table className="admin-table admin-table-cards">
              <thead><tr><th scope="col">سفارش</th><th scope="col">مشتری</th><th scope="col">مبلغ</th>
                <th scope="col">پرداخت</th><th scope="col">وضعیت</th><th scope="col"><span className="sr-only">جزئیات</span></th></tr></thead>
              <tbody>{data.items.map(order => {
                const payment = paymentState(order.payment, order.status);
                return <tr key={order.id}>
                  <td data-label="سفارش"><strong><bdi dir="ltr">#{shortId(order.id)}</bdi></strong>
                    <span className="admin-sub">{formatDateTime(order.createdAt)}</span></td>
                  <td data-label="مشتری">{order.customer ?? '—'}<span className="admin-sub">{order.city}، {order.province} ·
                    {' ' + formatNumber(order.units)} قلم</span></td>
                  <td data-label="مبلغ" className="admin-nowrap">{formatToman(order.total)}
                    <span className="admin-sub">{PAYMENT_METHOD[order.payment]}</span></td>
                  <td data-label="پرداخت"><Badge tone={payment.tone}>{payment.label}</Badge></td>
                  <td data-label="وضعیت"><Badge tone={statusTone(order.status)}>{statusLabel(order.status)}</Badge></td>
                  <td><button type="button" className="admin-btn admin-btn-outline admin-btn-small"
                    aria-label={'جزئیات سفارش ' + shortId(order.id)} onClick={() => setSelected(order.id)}>جزئیات</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} unit="سفارش"
            onPage={next => { setLoading(true); setPage(next); }}/>
        </> : <div className="admin-empty"><ClipboardList size={30} aria-hidden="true"/>
          <p>{search || status !== 'all' ? 'سفارشی با این فیلتر پیدا نشد.' : 'هنوز سفارشی ثبت نشده است.'}</p></div>}
    </section>
  </div>;
}
