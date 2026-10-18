'use client';

import { useEffect, useState } from 'react';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { AUDIT_ACTION, formatDateTime, formatNumber, statusLabel } from '@/components/admin/labels';
import { Loading, Notice } from '@/components/admin/ui';

type Entry = { id: number; action: string; target: string; details: Record<string, unknown>; created_at: string;
  actor: string | null; actorName: string | null };
const num = (value: unknown) => typeof value === 'number' ? formatNumber(value) : '—';

/** One line summary of what changed, from the structured audit details. */
function summary(entry: Entry): string {
  const d = entry.details ?? {};
  switch (entry.action) {
    case 'products.price': case 'inventory.stock': return num(d.from) + ' ← ' + num(d.to);
    case 'orders.status': return statusLabel(String(d.from)) + ' ← ' + statusLabel(String(d.to)) +
      (typeof d.restocked === 'number' && d.restocked ? ' · ' + num(d.restocked) + ' عدد به موجودی برگشت' : '');
    case 'products.visibility': return d.active ? 'منتشر شد' : 'از ویترین برداشته شد';
    case 'products.updated': return Array.isArray(d.fields) && d.fields.length ? 'فیلدها: ' + d.fields.join('، ') : '';
    case 'staff.updated': return Object.keys(d).join('، ');
    default: return '';
  }
}

export function AuditLog() {
  const [items, setItems] = useState<Entry[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    adminApi<{ items: Entry[] }>('audit' + (before ? '?before=' + before : ''), { signal: controller.signal })
      .then(result => { setItems(old => before ? [...old, ...result.items] : result.items); setMore(result.items.length === 100); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [before]);
  return <section className="admin-panel" aria-labelledby="audit-title">
    <div className="admin-panel-head"><div><h2 id="audit-title">تاریخچه فعالیت‌ها</h2>
      <p>ثبت غیرقابل‌ویرایش ورودها، تغییر قیمت و موجودی، محصولات، سفارش‌ها و دسترسی کارکنان</p></div></div>
    {error && <div className="admin-panel-body"><Notice tone="error">{error}</Notice></div>}
    {loading && !items.length ? <div className="admin-panel-body"><Loading label="در حال دریافت تاریخچه…"/></div> : <>
      <div className="admin-table-scroll">
        <table className="admin-table admin-table-cards">
          <thead><tr><th scope="col">زمان</th><th scope="col">کاربر</th><th scope="col">رویداد</th>
            <th scope="col">مورد</th><th scope="col">جزئیات</th></tr></thead>
          <tbody>{items.map(item => <tr key={item.id}>
            <td data-label="زمان" className="admin-nowrap">{formatDateTime(item.created_at)}</td>
            <td data-label="کاربر">{item.actorName ?? item.actor ?? 'نامشخص'}</td>
            <td data-label="رویداد">{AUDIT_ACTION[item.action] ?? item.action}</td>
            <td data-label="مورد"><bdi dir="ltr" className="admin-mono">{item.target}</bdi></td>
            <td data-label="جزئیات">{summary(item)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {more && items.length > 0 && <div className="admin-pager"><span/>
        <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={loading}
          onClick={() => { setLoading(true); setBefore(items.at(-1)!.id); }}>نمایش موارد قدیمی‌تر</button></div>}
    </>}
  </section>;
}
