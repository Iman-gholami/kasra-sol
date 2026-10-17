'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ClipboardList, ExternalLink, LayoutDashboard, LogOut, Package, ScrollText, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ProductEditor } from '@/components/admin/product-editor';
import { SalesOverview } from '@/components/admin/sales-overview';
import { ProductList, type ProductRow } from '@/components/admin/product-list';

export type AdminUser = {
  id: string; username: string; displayName: string; role: 'owner' | 'manager' | 'staff';
  active: boolean; grants: string[]; revokes: string[]; permissions: string[];
};
type Variant = { id: string; product_id: string; color_id: string; size: string; stock: number };
type Order = {
  id: string; status: string; payment: string; shipping: string;
  total: number; created_at: string;
  address: { name?: string; province?: string; city?: string };
};
type Section = 'overview' | 'products' | 'orders' | 'staff' | 'audit';
type Audit = { id: number; action: string; actor?: string; target: string; created_at: string };
const formatPrice = (price: number) => new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
const dateTime = (date: string) => new Date(date).toLocaleString('fa-IR');
const NEXT_ORDER_STATUS: Record<string, { value: string; label: string }> = {
  confirmed_cod: { value: 'preparing', label: 'شروع آماده‌سازی' },
  preparing: { value: 'shipped', label: 'ثبت ارسال سفارش' },
  shipped: { value: 'delivered', label: 'ثبت تحویل سفارش' }
};

async function api<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  const response = await fetch('/api/admin/' + path, {
    method, cache: 'no-store',
    headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('نشست شما منقضی شده است؛ دوباره وارد شوید.');
    if (response.status === 403) throw new Error('مجوز انجام این کار را ندارید.');
    throw new Error('عملیات ناموفق بود (کد ' + response.status + ').');
  }
  return response.json() as Promise<T>;
}
const STAFF_TOGGLES = [
  ['products:price', 'تغییر قیمت'], ['products:write', 'ویرایش محصول'],
  ['inventory:write', 'ویرایش موجودی'], ['orders:fulfill', 'رسیدگی به سفارش'],
  ['reports:read', 'مشاهده گزارش‌ها']
] as const;
function StaffItem({ member, refresh }: { member: AdminUser; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (member.role === 'owner') return <div className="rounded border bg-neutral-50 p-3">
    {member.displayName} ({member.username}) — صاحب فروشگاه
  </div>;
  async function update(patch: Record<string, unknown>) {
    setBusy(true); setError('');
    try { await api('staff/' + member.id, 'PATCH', patch); refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : 'خطا'); }
    finally { setBusy(false); }
  }
  function toggle(permission: string) {
    const grants = member.grants.filter(item => item !== permission);
    const revokes = member.revokes.filter(item => item !== permission);
    if (member.permissions.includes(permission)) revokes.push(permission);
    else grants.push(permission);
    void update({ grants, revokes });
  }
  return <article className="grid gap-3 rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><strong>{member.displayName}</strong> <small dir="ltr">{member.username}</small>
        <p className="text-sm text-neutral-600">{member.active ? 'فعال' : 'غیرفعال'}</p></div>
      <div className="flex flex-wrap gap-2">
        <label>نقش
          <select className="ms-2 rounded border p-2" disabled={busy} value={member.role}
            onChange={event => void update({ role: event.target.value })}>
            <option value="manager">مدیر فروشگاه</option><option value="staff">کارمند</option>
          </select>
        </label>
        <button className="admin-btn admin-btn-outline admin-btn-small" disabled={busy}
          onClick={() => void update({ active: !member.active })}>
          {member.active ? 'غیرفعال‌کردن حساب' : 'فعال‌کردن حساب'}
        </button>
      </div>
    </div>
    <fieldset className="flex flex-wrap gap-4">
      <legend className="mb-2 text-sm font-semibold">مجوزهای قابل تنظیم</legend>
      {STAFF_TOGGLES.map(([permission, label]) => <label key={permission} className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={member.permissions.includes(permission)} disabled={busy}
          onChange={() => toggle(permission)}/>{label}
      </label>)}
    </fieldset>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </article>;
}
export function AdminDashboard({ user }: { user: AdminUser }) {
  const router = useRouter();
  const [section, setSection] = useState<Section>(user.permissions.includes('reports:read') ? 'overview' : 'products');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productEditor, setProductEditor] = useState<string | 'new' | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!user.permissions.includes('reports:read'));
  const [revision, setRevision] = useState(0);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'staff' | 'manager'>('staff');
  const [savingStaff, setSavingStaff] = useState(false);
  const can = (permission: string) => user.permissions.includes(permission);
  useEffect(() => {
    if (section === 'overview') return;
    if (section === 'staff' && !user.permissions.includes('staff:manage')) return;
    if (section === 'audit' && !user.permissions.includes('staff:manage')) return;
    if (section === 'orders' && !user.permissions.includes('orders:read')) return;
    if (section === 'products' && !user.permissions.includes('products:read')) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/admin/' + section, { signal: controller.signal, cache: 'no-store' });
        if (response.status === 401) { router.replace('/admin/login'); return; }
        if (!response.ok) throw new Error('دریافت اطلاعات ناموفق بود.');
        const data = await response.json() as { items: never[] };
        if (controller.signal.aborted) return;
        if (section === 'products') setProducts(data.items);
        if (section === 'orders') setOrders(data.items);
        if (section === 'staff') setStaff(data.items);
        if (section === 'audit') setAudit(data.items);
        setError('');
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'خطا');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [section, revision, router, user.permissions]);

  const refresh = () => { setLoading(true); setRevision(i => i + 1); };
  async function signOut() {
    try { await api('auth/logout', 'POST'); } finally {
      router.replace('/admin/login'); router.refresh();
    }
  }
  async function createStaff(event: FormEvent) {
    event.preventDefault(); setSavingStaff(true); setError('');
    try {
      await api('staff', 'POST', { username: newUsername.toLowerCase().trim(), displayName: newName,
        password: newPassword, role: newRole });
      setNewPassword(''); setNewUsername(''); setNewName('');
      refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'خطا'); }
    finally { setSavingStaff(false); }
  }
  const tabs = ([
    ['overview', 'داشبورد فروشگاه', 'reports:read'],
    ['products', 'محصولات و موجودی', 'products:read'],
    ['orders', 'سفارش‌ها', 'orders:read'],
    ['staff', 'کارکنان و مجوزها', 'staff:manage'],
    ['audit', 'تاریخچه تغییرات', 'staff:manage']
  ] as const).filter(([, , permission]) => can(permission));

  const navIcons = {
    overview: LayoutDashboard, products: Package, orders: ClipboardList, staff: UsersRound, audit: ScrollText
  };
  const titleMap: Record<Section, string> = {
    overview: 'داشبورد فروشگاه', products: 'محصولات و موجودی',
    orders: 'مدیریت سفارش‌ها', staff: 'کارکنان و مجوزها', audit: 'تاریخچه فعالیت‌ها'
  };
  return <section className="admin-app" data-testid="admin-app">
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span className="admin-brand-mark" aria-hidden="true">K</span>
        <div><p className="admin-brand-title">کسری بوتیک</p><p className="admin-brand-subtitle">پنل مدیریت فروشگاه</p></div>
      </div>
      <p className="admin-nav-head">منوی اصلی</p>
      <nav className="admin-navigation" aria-label="بخش‌های مدیریت">
        {tabs.map(([id, label]) => {
          const Icon = navIcons[id];
          return <button type="button" key={id} aria-current={section === id ? 'page' : undefined}
            onClick={() => { setLoading(id !== 'overview'); setSection(id); }}>
            <Icon size={19} aria-hidden="true"/>{label}
          </button>;
        })}
      </nav>
      <div className="admin-side-spacer"/>
      <div className="admin-side-note">
        <strong>فضای مدیریت اختصاصی</strong>
        <span>تغییرات این پنل تنها با حساب‌های مجاز ثبت می‌شوند.</span>
        <Link href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={13} aria-hidden="true"/> مشاهده فروشگاه</Link>
      </div>
      <button type="button" className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-emerald-50 hover:bg-white/10"
        onClick={() => void signOut()}><LogOut size={18} aria-hidden="true"/> خروج از حساب</button>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <div><h1 className="admin-page-title">{titleMap[section]}</h1>
          <p className="admin-page-subtitle">کسری بوتیک / پنل مدیریت</p>
        </div>
        <div className="admin-account">
          <div className="text-left">
            <span className="admin-account-name">{user.displayName}</span>
            <span className="admin-account-role">{user.role === 'owner' ? 'صاحب فروشگاه' :
              user.role === 'manager' ? 'مدیر فروشگاه' : 'کارمند فروشگاه'}</span>
          </div>
          <div className="admin-avatar" aria-hidden="true">{user.displayName.slice(0, 1)}</div>
        </div>
      </header>
      <div className="admin-main">
    {error && <p role="alert" className="mb-4 rounded border border-red-300 p-3 text-red-700">{error}</p>}
    {loading && section !== 'overview' && <p role="status">در حال دریافت اطلاعات…</p>}
    {section === 'overview' && can('reports:read') && <SalesOverview/>}
    {section === 'products' && productEditor !== null &&
      <ProductEditor productId={productEditor === 'new' ? undefined : productEditor}
        done={() => { setProductEditor(null); refresh(); }}/>}
    {!loading && section === 'products' && productEditor === null &&
      <ProductList products={products} permissions={user.permissions} refreshed={refresh}
        edit={setProductEditor} create={() => setProductEditor('new')}/>}

    {!loading && section === 'orders' && <div className="grid gap-3">
      <h2 className="text-xl font-semibold">آخرین سفارش‌ها</h2>
      <p className="text-sm text-neutral-600">سفارش آنلاین pending_payment پرداخت‌نشده است و تأیید آن فقط پس از اتصال درگاه واقعی مجاز خواهد بود.</p>
      {orders.map(item => <article key={item.id} className="admin-info-card">
        <div className="flex flex-wrap justify-between gap-2">
          <div><strong dir="ltr">{item.id}</strong><p>{item.address?.name} · {item.address?.province}، {item.address?.city}</p></div>
          <div><p>{item.status} · {item.payment}</p><p>{formatPrice(item.total)}</p></div>
        </div>
        <p className="text-sm text-neutral-600">{dateTime(item.created_at)}</p>
        {can('orders:fulfill') && NEXT_ORDER_STATUS[item.status] &&
          <button type="button" className="mt-2 rounded bg-neutral-900 px-3 py-2 text-white"
            onClick={() => void api('orders/' + item.id + '/status', 'PATCH', {
              status: NEXT_ORDER_STATUS[item.status].value
            }).then(refresh).catch(e => setError(e instanceof Error ? e.message : 'خطا'))}>
            {NEXT_ORDER_STATUS[item.status].label}
          </button>}
      </article>)}
      {orders.length === 0 && <p>سفارشی ثبت نشده است.</p>}
    </div>}
    {!loading && section === 'staff' && can('staff:manage') && <div className="grid gap-5">
      <h2 className="text-xl font-semibold">کارکنان و دسترسی‌ها</h2>
      <form onSubmit={createStaff} className="admin-form-card grid gap-3 sm:grid-cols-2">
        <h3 className="sm:col-span-2 font-semibold">ایجاد حساب کارمند</h3>
        <label className="grid gap-1">نام کاربری (لاتین)
          <input dir="ltr" required minLength={3} pattern="[a-z0-9][a-z0-9_.-]{2,63}"
            className="rounded border p-2" value={newUsername} onChange={e => setNewUsername(e.target.value)}/>
        </label>
        <label className="grid gap-1">نام نمایشی
          <input required minLength={2} className="rounded border p-2"
            value={newName} onChange={e => setNewName(e.target.value)}/>
        </label>
        <label className="grid gap-1">رمز عبور اولیه (حداقل ۱۲ کاراکتر)
          <input type="password" autoComplete="new-password" required minLength={12} className="rounded border p-2"
            value={newPassword} onChange={e => setNewPassword(e.target.value)}/>
        </label>
        <label className="grid gap-1">نقش
          <select className="rounded border p-2" value={newRole}
            onChange={e => setNewRole(e.target.value as 'staff' | 'manager')}>
            <option value="staff">کارمند</option><option value="manager">مدیر فروشگاه</option>
          </select>
        </label>
        <button disabled={savingStaff} className="admin-btn admin-btn-primary sm:col-span-2">
          {savingStaff ? 'در حال ایجاد…' : 'ساخت حساب مستقل'}
        </button>
      </form>
      {staff.map(member => <StaffItem key={member.id} member={member} refresh={refresh}/>)}
    </div>}
    {!loading && section === 'audit' && can('staff:manage') && <div className="grid gap-3">
      <h2 className="text-xl font-semibold">آخرین تغییرات</h2>
      {audit.map(item => <div className="rounded border bg-white p-3" key={item.id}>
        <strong>{item.actor ?? 'نامشخص'} — {item.action}</strong>
        <p className="text-sm">{item.target} · {dateTime(item.created_at)}</p>
      </div>)}
    </div>}
      </div>
    </div>
  </section>;
}
