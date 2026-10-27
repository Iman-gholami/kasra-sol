'use client';

import { useState, type FormEvent } from 'react';
import { ShieldPlus } from 'lucide-react';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { formatNumber, PERMISSION } from '@/components/admin/labels';
import { Notice } from '@/components/admin/ui';

export type CustomRole = { id: string; name: string; permissions: string[]; memberCount: number };
// The labels are the list of delegatable permissions. Owner-only actions are never offered here.
export const DELEGABLE = Object.keys(PERMISSION);

export function RoleManager({ roles, refresh }: { roles: CustomRole[]; refresh: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const reset = () => { setEditing(null); setName(''); setPermissions([]); };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (editing && !window.confirm('این نقش ویرایش شود؟ نشست حساب‌های دارای این نقش بسته می‌شود.')) return;
    setBusy(true); setMessage(null);
    try {
      await adminApi(editing ? 'roles/' + editing : 'roles', {
        method: editing ? 'PUT' : 'POST', body: { name: name.trim(), permissions }
      });
      setMessage({ tone: 'success', text: editing ? 'نقش و دسترسی‌های آن به‌روزرسانی شد.' : 'نقش جدید ساخته شد.' });
      reset(); refresh();
    } catch (error) { setMessage({ tone: 'error', text: errorMessage(error) }); }
    finally { setBusy(false); }
  }
  async function remove(role: CustomRole) {
    if (!window.confirm('نقش «' + role.name + '» حذف شود؟ این عمل قابل بازگشت نیست.')) return;
    setBusy(true); setMessage(null);
    try {
      await adminApi('roles/' + role.id, { method: 'DELETE' });
      if (editing === role.id) reset();
      setMessage({ tone: 'success', text: 'نقش «' + role.name + '» حذف شد.' });
      refresh();
    } catch (error) { setMessage({ tone: 'error', text: errorMessage(error) }); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel" aria-labelledby="custom-roles-title">
    <div className="admin-panel-head"><div><h2 id="custom-roles-title"><ShieldPlus size={18} aria-hidden="true"/> نقش‌های دلخواه</h2>
      <p>برای وظایف مختلف نقش بسازید و آن را به حساب کارکنان اختصاص دهید. نقش‌های اصلی و حساب صاحب فروشگاه محفوظ‌اند.</p></div></div>
    <div className="admin-panel-body admin-stack">
      {roles.length > 0 && <div className="admin-stack-sm">{roles.map(role => <article className="admin-member" key={role.id}>
        <div className="admin-member-head"><strong>{role.name}</strong><span className="admin-sub">{formatNumber(role.memberCount)} حساب</span></div>
        <p className="admin-sub">{role.permissions.length ? role.permissions.map(p => PERMISSION[p]?.label ?? p).join('، ') : 'بدون مجوز اضافی'}</p>
        <div className="admin-actions">
          <button type="button" disabled={busy} className="admin-btn admin-btn-outline admin-btn-small"
            onClick={() => { setEditing(role.id); setName(role.name); setPermissions([...role.permissions]); setMessage(null); }}>
            ویرایش نقش {role.name}</button>
          <button type="button" disabled={busy} className="admin-btn admin-btn-danger admin-btn-small"
            onClick={() => void remove(role)}>حذف نقش {role.name}</button>
        </div>
        {role.memberCount > 0 && <p className="admin-sub">برای حذف، ابتدا نقش حساب‌های مرتبط را تغییر دهید.</p>}
      </article>)}</div>}
      <form onSubmit={save} className="admin-stack-sm">
        <h3 className="admin-section-title">{editing ? 'ویرایش نقش' : 'ساخت نقش جدید'}</h3>
        <label className="admin-field">نام نقش
          <input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)}
            placeholder="مثلاً مسئول سفارش‌ها"/>
        </label>
        <fieldset className="admin-permissions" disabled={busy}>
          <legend>مجوزهای نقش</legend>
          {DELEGABLE.map(permission => <label key={permission} className="admin-check">
            <input type="checkbox" checked={permissions.includes(permission)} onChange={event => {
              const checked = event.target.checked;
              setPermissions(current => checked ? [...current, permission] : current.filter(item => item !== permission));
            }}/>
            <span>{PERMISSION[permission].label}<small>{PERMISSION[permission].hint}</small></span>
          </label>)}
        </fieldset>
        <div className="admin-actions">
          <button type="submit" disabled={busy} className="admin-btn admin-btn-primary admin-btn-small">
            {busy ? 'در حال ذخیره…' : editing ? 'ذخیره نقش' : 'ایجاد نقش'}</button>
          {editing && <button type="button" disabled={busy} className="admin-btn admin-btn-outline admin-btn-small" onClick={reset}>انصراف از ویرایش</button>}
        </div>
      </form>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
    </div>
  </section>;
}
