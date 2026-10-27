'use client';

import { useEffect, useState } from 'react';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import {
  AUDIT_ACTION, AUDIT_GROUP, formatDateTime, formatNumber, PERMISSION, PRODUCT_FIELD, ROLE, statusLabel, STORE_PAYMENT
} from '@/components/admin/labels';
import { Loading, Notice } from '@/components/admin/ui';

type Entry = { id: number; action: string; target: string; details: Record<string, unknown>; created_at: string;
  actor: string | null; actorName: string | null; targetName: string | null };
type Member = { id: string; displayName: string; username: string };
const num = (value: unknown) => typeof value === 'number' ? formatNumber(value) : '—';
const change = (from: unknown, to: unknown) => num(from) + ' ← ' + num(to);
const permissions = (value: unknown) => Array.isArray(value)
  ? value.map(p => PERMISSION[String(p)]?.label ?? String(p)).join('، ') : '';

/** One line summary of what changed, from the structured audit details. */
function summary(entry: Entry): string {
  const d = entry.details ?? {};
  switch (entry.action) {
    case 'products.price': return change(d.from, d.to) + ' تومان';
    case 'inventory.stock': return 'رنگ ' + String(d.colorId ?? '—') + ' · سایز ' + String(d.size ?? '—') + ': ' + change(d.from, d.to);
    case 'orders.status': return statusLabel(String(d.from)) + ' ← ' + statusLabel(String(d.to)) +
      (typeof d.restocked === 'number' && d.restocked ? ' · ' + num(d.restocked) + ' عدد به موجودی برگشت' : '');
    case 'products.visibility': return d.active ? 'منتشر شد' : 'از ویترین برداشته شد';
    case 'products.created': return 'پیش‌نویس با قیمت ' + num(d.price) + ' تومان';
    case 'products.updated': {
      const price = d.price as { from?: unknown; to?: unknown } | undefined;
      return [
        Array.isArray(d.fields) && d.fields.length ? 'تغییر ' + d.fields.map(f => PRODUCT_FIELD[String(f)] ?? String(f)).join('، ') : '',
        price ? 'قیمت ' + change(price.from, price.to) : '',
        Array.isArray(d.stock) && d.stock.length ? 'موجودی ' + num(d.stock.length) + ' ترکیب رنگ و سایز' : ''
      ].filter(Boolean).join(' · ');
    }
    case 'staff.created': return typeof d.customRoleName === 'string' ? d.customRoleName : ROLE[String(d.role)] ?? '';
    case 'staff.role_created': case 'staff.role_updated': case 'staff.role_deleted':
      return typeof d.name === 'string' ? d.name : '';
    case 'staff.updated': {
      const grants = permissions(d.grants), revokes = permissions(d.revokes);
      return [
        typeof d.role === 'string' ? 'نقش: ' + (ROLE[d.role] ?? d.role) : '',
        typeof d.active === 'boolean' ? (d.active ? 'فعال شد' : 'غیرفعال شد') : '',
        typeof d.displayName === 'string' ? 'نام نمایشی: ' + d.displayName : '',
        grants ? 'دسترسی افزوده: ' + grants : '',
        revokes ? 'دسترسی گرفته‌شده: ' + revokes : '',
        'grants' in d && 'revokes' in d && !grants && !revokes ? 'دسترسی‌ها برابر پیش‌فرض نقش' : ''
      ].filter(Boolean).join(' · ');
    }
    case 'orders.exported': return num(d.count) + ' سفارش';
    case 'inventory.received': return 'رسید ' + num(Number(entry.target)) + ' · ' + num(d.units) + ' عدد به موجودی افزوده شد';
    case 'sales.recorded': return 'فاکتور ' + num(Number(entry.target)) + ' · ' + num(d.units) + ' عدد · ' + num(d.total) + ' تومان · ' +
      (STORE_PAYMENT[String(d.payment)] ?? '');
    case 'sales.voided': return 'فاکتور ' + num(Number(entry.target)) + ' · ' + num(d.restocked) + ' عدد به موجودی برگشت' +
      (typeof d.reason === 'string' ? ' · ' + d.reason : '');
    case 'products.home_slider': return Array.isArray(d.to)
      ? (d.to.length ? num(d.to.length) + ' محصول به ترتیب انتخاب‌شده' : 'خالی؛ محصولات تخفیف‌دار نمایش داده می‌شوند') : '';
    case 'media.uploaded': return typeof d.bytes === 'number' ? formatNumber(Math.ceil(d.bytes / 1024)) + ' کیلوبایت' : '';
    case 'auth.login': case 'auth.login_failed': case 'auth.login_locked':
      return typeof d.ip === 'string' ? 'IP: ' + d.ip : '';
    default: return '';
  }
}

export function AuditLog() {
  const [items, setItems] = useState<Entry[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [filters, setFilters] = useState({ group: '', actor: '' });
  const [members, setMembers] = useState<Member[]>([]);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    adminApi<{ items: Member[] }>('staff', { signal: controller.signal })
      .then(result => setMembers(result.items)).catch(() => { /* the user filter is optional */ });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ ...(before ? { before: String(before) } : {}),
      ...(filters.group ? { group: filters.group } : {}), ...(filters.actor ? { actor: filters.actor } : {}) });
    adminApi<{ items: Entry[] }>('audit' + (params.size ? '?' + params : ''), { signal: controller.signal })
      .then(result => { setItems(old => before ? [...old, ...result.items] : result.items); setMore(result.items.length === 100); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [before, filters]);
  function filter(patch: Partial<typeof filters>) {
    setLoading(true); setItems([]); setBefore(null);
    setFilters(old => ({ ...old, ...patch }));
  }
  const filtered = Boolean(filters.group || filters.actor);
  return <section className="admin-panel" aria-labelledby="audit-title">
    <div className="admin-panel-head"><div><h2 id="audit-title">تاریخچه فعالیت‌ها</h2>
      <p>ثبت غیرقابل‌ویرایش ورودها، تغییر قیمت و موجودی، محصولات، سفارش‌ها و دسترسی کارکنان</p></div>
      <div className="admin-toolbar-controls">
        <label className="admin-inline-field"><span className="sr-only">نوع رویداد</span>
          <select value={filters.group} onChange={event => filter({ group: event.target.value })}>
            <option value="">همه رویدادها</option>
            {Object.entries(AUDIT_GROUP).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="admin-inline-field"><span className="sr-only">کاربر</span>
          <select value={filters.actor} onChange={event => filter({ actor: event.target.value })}>
            <option value="">همه کاربران</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.displayName} ({member.username})</option>)}
          </select>
        </label>
      </div>
    </div>
    {error && <div className="admin-panel-body"><Notice tone="error">{error}</Notice></div>}
    {loading && !items.length ? <div className="admin-panel-body"><Loading label="در حال دریافت تاریخچه…"/></div>
      : !items.length ? <p className="admin-empty">{filtered ? 'رویدادی با این فیلتر ثبت نشده است.' : 'هنوز رویدادی ثبت نشده است.'}</p> : <>
        <div className="admin-table-scroll">
          <table className="admin-table admin-table-cards">
            <thead><tr><th scope="col">زمان</th><th scope="col">کاربر</th><th scope="col">رویداد</th>
              <th scope="col">مورد</th><th scope="col">جزئیات</th></tr></thead>
            <tbody>{items.map(item => <tr key={item.id}>
              <td data-label="زمان" className="admin-nowrap">{formatDateTime(item.created_at)}</td>
              <td data-label="کاربر">{item.actorName ?? item.actor ?? 'نامشخص'}</td>
              <td data-label="رویداد">{AUDIT_ACTION[item.action] ?? item.action}</td>
              <td data-label="مورد">{item.targetName && <span className="admin-audit-target">{item.targetName}</span>}
                <bdi dir="ltr" className="admin-mono">{item.target}</bdi></td>
              <td data-label="جزئیات">{summary(item)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {more && <div className="admin-pager"><span/>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={loading}
            onClick={() => { setLoading(true); setBefore(items.at(-1)!.id); }}>نمایش موارد قدیمی‌تر</button></div>}
      </>}
  </section>;
}
