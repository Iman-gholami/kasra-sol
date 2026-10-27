'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, Lock, Trash2, UserPlus } from 'lucide-react';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { formatDateTime, PERMISSION, ROLE } from '@/components/admin/labels';
import { Badge, Loading, Notice } from '@/components/admin/ui';
import { DELEGABLE, RoleManager, type CustomRole } from '@/components/admin/role-manager';
import type { AdminUser } from '@/components/admin/admin-dashboard';

type Member = AdminUser & { lockedUntil?: string | null };
// Owner-only permissions (staff management, payment settings) are never offered: the API refuses them too.
const roleValue = (member: Member) => member.customRoleId ? 'custom:' + member.customRoleId : member.role;
const roleName = (value: string, roles: CustomRole[]) => value.startsWith('custom:')
  ? roles.find(role => role.id === value.slice(7))?.name ?? 'نقش دلخواه' : ROLE[value];
const rolePatch = (value: string) => value.startsWith('custom:')
  ? { role: 'staff', customRoleId: value.slice(7) } : { role: value, customRoleId: null };

/** A readable random password for handing to an employee once; they should change it after signing in. */
function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map(b => alphabet[b % alphabet.length]).join('').replace(/(.{4})(?!$)/g, '$1-');
}

function PasswordReset({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [state, setState] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm('رمز جدید برای «' + member.displayName + '» ثبت شود؟ نشست‌های فعال او بسته می‌شود.')) return;
    setBusy(true); setState(null);
    try {
      await adminApi('staff/' + member.id + '/password', { method: 'PUT', body: { password } });
      setState({ tone: 'success', text: 'رمز جدید ثبت شد. آن را حضوری یا از راه امن به کارمند بدهید.' });
    } catch (error) { setState({ tone: 'error', text: errorMessage(error) }); }
    finally { setBusy(false); }
  }
  if (!open) return <button type="button" className="admin-btn admin-btn-outline admin-btn-small"
    onClick={() => setOpen(true)}><KeyRound size={14} aria-hidden="true"/> تعیین رمز جدید</button>;
  return <form className="admin-reset" onSubmit={submit}>
    <label className="admin-field">رمز جدید (حداقل ۱۲ نویسه)
      <input dir="ltr" required minLength={12} maxLength={256} autoComplete="new-password" value={password}
        onChange={event => setPassword(event.target.value)}/>
    </label>
    <div className="admin-actions">
      <button type="button" className="admin-btn admin-btn-outline admin-btn-small" onClick={() => setPassword(generatePassword())}>ساخت رمز تصادفی</button>
      <button type="submit" disabled={busy} className="admin-btn admin-btn-primary admin-btn-small">{busy ? 'در حال ثبت…' : 'ثبت رمز'}</button>
      <button type="button" className="admin-btn admin-btn-outline admin-btn-small" onClick={() => { setOpen(false); setPassword(''); setState(null); }}>بستن</button>
    </div>
    {state && <Notice tone={state.tone}>{state.text}</Notice>}
  </form>;
}

function StaffItem({ member, roles, refresh }: { member: Member; roles: CustomRole[]; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState(member.displayName);
  // Checkboxes reflect a click at once; a failed save reverts them. A successful save remounts this card.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  if (member.role === 'owner') return <article className="admin-member">
    <div className="admin-member-head"><div><strong>{member.displayName}</strong> <bdi dir="ltr" className="admin-sub">{member.username}</bdi></div>
      <Badge tone="success">{ROLE.owner}</Badge></div>
    <p className="admin-sub">دسترسی کامل؛ مدیریت کارکنان و تنظیمات پرداخت فقط برای این حساب است.</p>
  </article>;
  async function update(patch: Record<string, unknown>, question?: string) {
    if (question && !window.confirm(question)) return false;
    setBusy(true); setError('');
    try { await adminApi('staff/' + member.id, { method: 'PATCH', body: patch }); refresh(); return true; }
    catch (cause) { setError(errorMessage(cause)); return false; }
    finally { setBusy(false); }
  }
  async function archive() {
    if (!window.confirm('حساب «' + member.displayName + '» از فهرست کارکنان حذف شود؟ دسترسی ورود فوراً قطع می‌شود، اما سوابق فروش و فعالیت برای گزارش‌ها حفظ می‌شوند.')) return;
    setBusy(true); setError('');
    try {
      await adminApi('staff/' + member.id, { method: 'DELETE' });
      refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  function toggle(permission: string) {
    const enabled = member.permissions.includes(permission);
    const grants = member.grants.filter(item => item !== permission);
    const revokes = member.revokes.filter(item => item !== permission);
    if (enabled) revokes.push(permission); else grants.push(permission);
    setPending(state => ({ ...state, [permission]: !enabled }));
    void update({ grants, revokes }).then(() => setPending(state => {
      const next = { ...state };
      delete next[permission];
      return next;
    }));
  }
  const locked = member.lockedUntil && new Date(member.lockedUntil) > new Date();
  return <article className="admin-member" data-inactive={!member.active || undefined} aria-busy={busy}>
    <div className="admin-member-head">
      <div><strong>{member.displayName}</strong> <bdi dir="ltr" className="admin-sub">{member.username}</bdi></div>
      <div className="admin-badges">
        <Badge tone={member.active ? 'success' : 'neutral'}>{member.active ? 'فعال' : 'غیرفعال'}</Badge>
        {locked && <Badge tone="danger"><Lock size={12} aria-hidden="true"/> قفل موقت تا {formatDateTime(member.lockedUntil!)}</Badge>}
      </div>
    </div>
    <div className="admin-actions">
      <label className="admin-inline-field">نقش
        <select disabled={busy} value={roleValue(member)} onChange={event => void update(rolePatch(event.target.value),
          'نقش «' + member.displayName + '» به «' + roleName(event.target.value, roles) + '» تغییر کند؟ دسترسی‌های اختصاصی قبلی پاک و نشست‌های فعال بسته می‌شود.')}>
          <option value="manager">{ROLE.manager}</option><option value="staff">{ROLE.staff}</option>
          {roles.map(role => <option key={role.id} value={'custom:' + role.id}>{role.name}</option>)}
        </select>
      </label>
      <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={busy}
        onClick={() => { setName(member.displayName); setNameOpen(open => !open); }}>ویرایش نام</button>
      <button type="button" className={'admin-btn admin-btn-small ' + (member.active ? 'admin-btn-danger' : 'admin-btn-outline')} disabled={busy}
        onClick={() => void update({ active: !member.active }, member.active
          ? 'حساب «' + member.displayName + '» غیرفعال شود؟ همه نشست‌های فعال او فوراً بسته می‌شود.' : undefined)}>
        {member.active ? 'غیرفعال‌کردن حساب' : 'فعال‌کردن حساب'}
      </button>
      <PasswordReset member={member}/>
      <button type="button" className="admin-btn admin-btn-danger admin-btn-small" disabled={busy}
        onClick={() => void archive()} aria-label={'حذف کارمند ' + member.displayName}>
        <Trash2 size={14} aria-hidden="true"/> حذف کارمند
      </button>
    </div>
    {nameOpen && <form className="admin-actions" onSubmit={event => {
      event.preventDefault();
      void update({ displayName: name.trim() }).then(saved => { if (saved) setNameOpen(false); });
    }}>
      <label className="admin-inline-field">نام نمایشی
        <input required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)}/>
      </label>
      <button type="submit" disabled={busy} className="admin-btn admin-btn-primary admin-btn-small">ذخیره نام</button>
      <button type="button" className="admin-btn admin-btn-outline admin-btn-small" onClick={() => setNameOpen(false)}>انصراف</button>
    </form>}
    <details className="admin-permission-details">
      <summary>نمایش و ویرایش مجوزها</summary>
      <fieldset className="admin-permissions" disabled={busy}>
        <legend>مجوزهای قابل تنظیم <span className="admin-sub">(تغییر هر مورد، نشست‌های فعال کارمند را می‌بندد)</span></legend>
        {DELEGABLE.map(permission => <label key={permission} className="admin-check">
          <input type="checkbox" checked={pending[permission] ?? member.permissions.includes(permission)} onChange={() => toggle(permission)}/>
          <span>{PERMISSION[permission].label}<small>{PERMISSION[permission].hint}</small></span>
        </label>)}
      </fieldset>
    </details>
    {error && <Notice tone="error">{error}</Notice>}
  </article>;
}

export function StaffManager() {
  const [staff, setStaff] = useState<Member[] | null>(null);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      adminApi<{ items: Member[] }>('staff', { signal: controller.signal }),
      adminApi<{ items: CustomRole[] }>('roles', { signal: controller.signal })
    ]).then(([members, customRoles]) => { setStaff(members.items); setRoles(customRoles.items); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [version]);
  const refresh = () => setVersion(v => v + 1);
  async function create(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setCreated('');
    try {
      await adminApi('staff', { method: 'POST', body: { ...form, ...rolePatch(form.role), username: form.username.trim().toLowerCase() } });
      setCreated('حساب «' + form.displayName + '» ساخته شد. نام کاربری و رمز را از راه امن تحویل دهید.');
      setForm({ username: '', displayName: '', password: '', role: 'staff' });
      refresh();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }
  return <div className="admin-stack">
    <Notice tone="info">هر کارمند حساب مستقل دارد. کارمند به‌طور پیش‌فرض فقط مشاهده محصولات، موجودی و سفارش‌ها را دارد و قیمت را تغییر نمی‌دهد.
      مدیریت کارکنان و تنظیمات پرداخت قابل واگذاری نیست.</Notice>
    <form onSubmit={create} className="admin-panel" aria-labelledby="create-staff-title">
      <div className="admin-panel-head"><div><h2 id="create-staff-title"><UserPlus size={18} aria-hidden="true"/> ایجاد حساب کارمند</h2></div></div>
      <div className="admin-panel-body admin-form-grid">
        <label className="admin-field">نام کاربری (لاتین)
          <input dir="ltr" required minLength={3} maxLength={64} pattern="[a-z0-9][a-z0-9_.\-]{2,63}" autoComplete="off"
            value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}/>
          <small>حروف کوچک لاتین، عدد، نقطه، خط تیره یا زیرخط</small>
        </label>
        <label className="admin-field">نام نمایشی
          <input required minLength={2} maxLength={100} value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}/>
        </label>
        <div className="admin-field">
          <label className="admin-field">رمز عبور اولیه (حداقل ۱۲ نویسه)
            <input dir="ltr" required minLength={12} maxLength={256} autoComplete="new-password"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}/>
          </label>
          <button type="button" className="admin-link-btn" onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}>ساخت رمز تصادفی</button>
        </div>
        <label className="admin-field">نقش
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            <option value="staff">{ROLE.staff} (دسترسی محدود)</option><option value="manager">{ROLE.manager} (محصول، قیمت، موجودی، سفارش)</option>
            {roles.map(role => <option key={role.id} value={'custom:' + role.id}>{role.name}</option>)}
          </select>
        </label>
        <div className="admin-field-wide admin-actions">
          <button disabled={saving} className="admin-btn admin-btn-primary">{saving ? 'در حال ایجاد…' : 'ساخت حساب مستقل'}</button>
        </div>
        {created && <div className="admin-field-wide"><Notice tone="success">{created}</Notice></div>}
      </div>
    </form>
    {error && <Notice tone="error">{error}</Notice>}
    <section aria-labelledby="staff-list-title" className="admin-stack">
      <h2 id="staff-list-title" className="admin-section-title">حساب‌ها</h2>
      {staff === null ? (!error && <Loading label="در حال دریافت حساب‌ها…"/>)
        : staff.map(member => <StaffItem key={member.id} member={member} roles={roles} refresh={refresh}/>)}
    </section>
    {staff && <RoleManager roles={roles} refresh={refresh}/>}
  </div>;
}
