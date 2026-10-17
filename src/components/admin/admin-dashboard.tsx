'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ProductEditor } from '@/components/admin/product-editor';
import { SalesOverview } from '@/components/admin/sales-overview';

export type AdminUser = {
  id: string; username: string; displayName: string; role: 'owner' | 'manager' | 'staff';
  active: boolean; grants: string[]; revokes: string[]; permissions: string[];
};
type Product = { id: string; slug: string; name: string; category: string; price: number; stock: number; active: boolean };
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
function ProductItem({ item, permissions, refreshed, editProduct }: { item: Product; permissions: string[]; refreshed: () => void; editProduct: (id: string) => void }) {
  const [price, setPrice] = useState(item.price);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function changeVisibility() {
    if (!confirm(item.active ? 'این محصول از فروشگاه پنهان شود؟' : 'این محصول منتشر شود؟')) return;
    setBusy(true); setMessage('');
    try {
      await api('products/' + item.id + '/visibility', 'PATCH', { active: !item.active });
      refreshed();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'خطا در تغییر وضعیت'); }
    finally { setBusy(false); }
  }
  async function changePrice(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await api('products/' + item.id + '/price', 'PATCH', { price });
      setMessage('قیمت ذخیره شد.'); refreshed();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'خطا'); }
    finally { setBusy(false); }
  }
  async function expand() {
    if (variants) { setVariants(null); return; }
    try {
      const result = await api<{ items: Variant[] }>('products/' + item.id + '/variants');
      setVariants(result.items);
      setStocks(Object.fromEntries(result.items.map(v => [v.id, v.stock])));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'خطا'); }
  }
  async function updateStock(id: string) {
    setBusy(true); setMessage('');
    try {
      const stock = stocks[id];
      await api('variants/' + id + '/stock', 'PATCH', { stock });
      setVariants(rows => rows?.map(v => v.id === id ? { ...v, stock } : v) ?? null);
      setMessage('موجودی ذخیره شد.'); refreshed();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'خطا'); }
    finally { setBusy(false); }
  }
  return <article className="rounded-xl border border-neutral-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">{item.name}</h3>
        <p className="text-xs text-neutral-600">{item.id} · {item.category} · موجودی کل: {item.stock} · {item.active ? 'منتشرشده' : 'آرشیوشده'}</p></div>
      {permissions.includes('products:price') ?
        <form onSubmit={changePrice} className="flex flex-wrap items-center gap-2">
          <label className="text-sm">قیمت (تومان)
            <input aria-label={'قیمت ' + item.name} type="number" min="0" max="1000000000" required
              value={price} onChange={event => setPrice(Number(event.target.value))}
              className="ms-2 w-36 rounded-md border p-2" dir="ltr"/>
          </label>
          <button disabled={busy} className="rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-50">ذخیره قیمت</button>
        </form> : <p>{formatPrice(item.price)}</p>}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {['products:write', 'products:price', 'inventory:write'].every(p => permissions.includes(p)) &&
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => editProduct(item.id)}>ویرایش کامل و تصاویر</button>}
      {permissions.includes('products:write') && <button type="button" disabled={busy}
        className="rounded border px-3 py-2 text-sm" onClick={() => void changeVisibility()}>
        {item.active ? 'آرشیو محصول' : 'انتشار محصول'}
      </button>}
    </div>
    {permissions.includes('inventory:read') &&
      <button className="mt-3 rounded border px-3 py-2 text-sm" onClick={expand}
        aria-expanded={variants !== null}>{variants ? 'بستن رنگ‌ها و سایزها' : 'مشاهده موجودی رنگ و سایز'}</button>}
    {variants && <div className="mt-3 grid gap-2">
      {variants.map(v => <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-neutral-50 p-2">
        <span>{v.color_id} / {v.size} (فعلی: {v.stock})</span>
        {permissions.includes('inventory:write') && <div className="flex gap-2">
          <input type="number" min="0" max="1000000" aria-label={'موجودی ' + v.color_id + ' ' + v.size}
            className="w-24 rounded border p-2" dir="ltr" value={stocks[v.id] ?? v.stock}
            onChange={event => setStocks(prev => ({ ...prev, [v.id]: Number(event.target.value) }))}/>
          <button type="button" onClick={() => updateStock(v.id)} disabled={busy}
            className="rounded border border-neutral-600 px-3 py-1 disabled:opacity-50">ثبت</button>
        </div>}
      </div>)}
    </div>}
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
  </article>;
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
        <button className="rounded border px-2" disabled={busy}
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
  const [products, setProducts] = useState<Product[]>([]);
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
    if (section === 'overview') { setLoading(false); return; }
    if (section === 'staff' && !can('staff:manage')) return;
    if (section === 'audit' && !can('staff:manage')) return;
    if (section === 'orders' && !can('orders:read')) return;
    if (section === 'products' && !can('products:read')) return;
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

  return <section className="mx-auto max-w-6xl px-4 py-8">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">مدیریت کسری بوتیک</h1>
        <p className="text-sm text-neutral-600">{user.displayName} · {user.username} · {user.role}</p>
      </div>
      <button onClick={() => void signOut()} className="rounded border px-4 py-2">خروج از حساب</button>
    </header>
    <nav aria-label="بخش‌های مدیریت" className="mb-6 flex flex-wrap gap-2">
      {tabs.map(([id, label]) => <button type="button" key={id}
        aria-current={section === id ? 'page' : undefined}
        className={section === id ? 'rounded bg-neutral-900 px-4 py-2 text-white' : 'rounded border px-4 py-2'}
        onClick={() => { setLoading(true); setSection(id); }}>{label}</button>)}
    </nav>
    {error && <p role="alert" className="mb-4 rounded border border-red-300 p-3 text-red-700">{error}</p>}
    {loading && <p role="status">در حال دریافت اطلاعات…</p>}
    {section === 'overview' && can('reports:read') && <SalesOverview/>}
    {section === 'products' && productEditor !== null &&
      <ProductEditor productId={productEditor === 'new' ? undefined : productEditor}
        done={() => { setProductEditor(null); refresh(); }}/>}
    {!loading && section === 'products' && productEditor === null && <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">محصولات ({products.length})</h2>
        {['products:write', 'products:price', 'inventory:write'].every(p => can(p)) &&
          <button type="button" className="rounded bg-neutral-900 px-4 py-2 text-white"
            onClick={() => setProductEditor('new')}>افزودن محصول جدید</button>}
      </div>
      {products.map(item => <ProductItem key={item.id} item={item} permissions={user.permissions}
        editProduct={setProductEditor} refreshed={refresh}/>)}
    </div>}
    {!loading && section === 'orders' && <div className="grid gap-3">
      <h2 className="text-xl font-semibold">آخرین سفارش‌ها</h2>
      <p className="text-sm text-neutral-600">سفارش آنلاین pending_payment پرداخت‌نشده است و تأیید آن فقط پس از اتصال درگاه واقعی مجاز خواهد بود.</p>
      {orders.map(item => <article key={item.id} className="rounded border bg-white p-4">
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
      <form onSubmit={createStaff} className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
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
        <button disabled={savingStaff} className="rounded bg-neutral-900 p-2 text-white disabled:opacity-50 sm:col-span-2">
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
  </section>;
}
