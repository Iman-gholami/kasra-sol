'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, ClipboardList, ExternalLink, GalleryHorizontal, LayoutDashboard, LogOut, Package, ScrollText, UserCog, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/components/admin/admin-api';
import { formatNumber, ROLE } from '@/components/admin/labels';
import { ProductEditor } from '@/components/admin/product-editor';
import { ProductList } from '@/components/admin/product-list';
import { SalesOverview } from '@/components/admin/sales-overview';
import { TrafficOverview } from '@/components/admin/traffic-overview';
import { OrderManager } from '@/components/admin/order-manager';
import { StaffManager } from '@/components/admin/staff-manager';
import { AuditLog } from '@/components/admin/audit-log';
import { AccountSettings } from '@/components/admin/account-settings';
import { HomeSliderManager } from '@/components/admin/home-slider-manager';
import { Notice } from '@/components/admin/ui';

export type AdminUser = {
  id: string; username: string; displayName: string; role: 'owner' | 'manager' | 'staff';
  customRoleId?: string | null; customRoleName?: string | null;
  active: boolean; grants: string[]; revokes: string[]; permissions: string[];
};
export type Section = 'overview' | 'traffic' | 'products' | 'home' | 'orders' | 'staff' | 'audit' | 'account';
// The menu mirrors the API's permissions; the API still enforces every one of them on each request.
const SECTIONS: { id: Section; label: string; title: string; permission: string | null; icon: typeof Package }[] = [
  { id: 'overview', label: 'داشبورد', title: 'داشبورد فروشگاه', permission: 'reports:read', icon: LayoutDashboard },
  { id: 'traffic', label: 'آمار بازدید', title: 'آمار بازدید', permission: 'reports:read', icon: Activity },
  { id: 'products', label: 'محصولات و موجودی', title: 'محصولات و موجودی', permission: 'products:read', icon: Package },
  { id: 'home', label: 'اسلایدر صفحه اول', title: 'اسلایدر صفحه اول', permission: 'products:write', icon: GalleryHorizontal },
  { id: 'orders', label: 'سفارش‌ها', title: 'مدیریت سفارش‌ها', permission: 'orders:read', icon: ClipboardList },
  { id: 'staff', label: 'کارکنان و مجوزها', title: 'کارکنان و مجوزها', permission: 'staff:manage', icon: UsersRound },
  { id: 'audit', label: 'تاریخچه فعالیت‌ها', title: 'تاریخچه فعالیت‌ها', permission: 'staff:manage', icon: ScrollText },
  { id: 'account', label: 'حساب من', title: 'حساب من', permission: null, icon: UserCog }
];

/** What the address bar holds: `?tab=`, and on the products tab an open editor (`edit=`: `new`, `copy:<id>` or an id)
 * or a list search (`q=`), so Back, Forward, reload and shared links all land on the same screen. */
type View = { section: Section; editor: string | null; q: string };
export type ViewParams = { tab?: string | null; edit?: string | null; q?: string | null };
const EDITOR = /^(new|(copy:)?[a-z0-9][a-z0-9-]{1,78})$/;
function resolveView(params: ViewParams, permissions: string[]): View {
  const allowed = SECTIONS.filter(item => !item.permission || permissions.includes(item.permission));
  const section = allowed.find(item => item.id === params.tab)?.id ?? allowed[0].id;
  const editor = section === 'products' && permissions.includes('products:write') && params.edit && EDITOR.test(params.edit)
    ? params.edit : null;
  return { section, editor, q: section === 'products' && !editor ? (params.q ?? '').slice(0, 100) : '' };
}
const addressOf = (view: View) => '/admin?' + new URLSearchParams({
  tab: view.section, ...(view.editor ? { edit: view.editor } : {}), ...(view.q ? { q: view.q } : {}) });

export function AdminDashboard({ user, initial }: { user: AdminUser; initial: ViewParams }) {
  const router = useRouter();
  const allowed = SECTIONS.filter(item => !item.permission || user.permissions.includes(item.permission));
  const [view, setView] = useState<View>(() => resolveView(initial, user.permissions));
  const [listVersion, setListVersion] = useState(0);
  const [saved, setSaved] = useState(false);
  const [newOrders, setNewOrders] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const current = useRef(view);
  // Set by the product editor and the home slider while their changes differ from what is stored: the question to
  // ask before leaving them, or null.
  const unsaved = useRef<string | null>(null);
  const setUnsaved = useCallback((question: string | null) => { unsaved.current = question; }, []);
  // Saving steps back through history to the list; the «saved» notice is carried across that step.
  const savedOnBack = useRef(false);
  const can = (permission: string) => user.permissions.includes(permission);
  const readsOrders = can('orders:read');
  const onOrders = view.section === 'orders';

  useEffect(() => { current.current = view; }, [view]);
  useEffect(() => {
    const expired = () => router.replace('/admin/login?expired=1');
    window.addEventListener('kasra-admin-unauthorized', expired);
    return () => window.removeEventListener('kasra-admin-unauthorized', expired);
  }, [router]);
  useEffect(() => {
    const back = () => {
      const params = new URLSearchParams(window.location.search);
      if (unsaved.current && !window.confirm(unsaved.current)) {
        window.history.pushState(null, '', addressOf(current.current));
        return;
      }
      unsaved.current = null;
      setSaved(savedOnBack.current);
      savedOnBack.current = false;
      setView(resolveView({ tab: params.get('tab'), edit: params.get('edit'), q: params.get('q') }, user.permissions));
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [user.permissions]);
  // New COD orders waiting to be processed, shown next to «سفارش‌ها». Refreshed every minute while the tab is
  // visible and whenever the orders section is left, where they are usually processed.
  useEffect(() => {
    if (!readsOrders) return;
    let stopped = false;
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      adminApi<{ total: number }>('orders?status=confirmed_cod&limit=1')
        .then(result => { if (!stopped) setNewOrders(result.total); }).catch(() => { /* the badge is optional */ });
    };
    check();
    const timer = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [readsOrders, onOrders]);

  function show(next: View, entry: 'push' | 'replace' = 'push', state: Record<string, unknown> | null = null) {
    unsaved.current = null;
    setView(next);
    if (entry === 'push') window.history.pushState(state, '', addressOf(next));
    else window.history.replaceState(state, '', addressOf(next));
  }
  function go(next: Section, q = '') {
    if (unsaved.current && !window.confirm(unsaved.current)) return;
    setSaved(false);
    show({ section: next, editor: null, q });
    // Screen readers and keyboard users land on the new section's heading instead of staying in the menu.
    requestAnimationFrame(() => heading.current?.focus());
  }
  function openEditor(editor: string) {
    setSaved(false);
    show({ ...view, editor, q: '' }, 'push', { fromList: true });
  }
  function closeEditor(changed: boolean) {
    unsaved.current = null;
    if (changed) setListVersion(v => v + 1);
    // Opened from the list: step back to that history entry, so Back afterwards does not reopen the editor.
    if ((window.history.state as { fromList?: boolean } | null)?.fromList) {
      savedOnBack.current = changed;
      window.history.back();
    } else {
      setSaved(changed);
      show({ section: 'products', editor: null, q: '' }, 'replace');
    }
  }
  async function signOut() {
    if (unsaved.current && !window.confirm(unsaved.current)) return;
    unsaved.current = null;
    try { await adminApi('auth/logout', { method: 'POST' }); } catch { /* the cookie is cleared regardless */ }
    router.replace('/admin/login'); router.refresh();
  }
  const section = SECTIONS.find(item => item.id === view.section)!;
  const editor = view.editor;
  return <div className="admin-app" data-testid="admin-app">
    <a className="skip-link" href="#admin-content">رفتن به محتوای اصلی</a>
    <aside className="admin-sidebar" aria-label="منوی پنل مدیریت">
      <div className="admin-brand">
        <span className="admin-brand-mark" aria-hidden="true">K</span>
        <div><p className="admin-brand-title">کسری بوتیک</p><p className="admin-brand-subtitle">پنل مدیریت فروشگاه</p></div>
      </div>
      <p className="admin-nav-head" aria-hidden="true">منوی اصلی</p>
      <nav className="admin-navigation" aria-label="بخش‌های مدیریت">
        {allowed.map(item => <button type="button" key={item.id} aria-current={view.section === item.id ? 'page' : undefined}
          onClick={() => go(item.id)}><item.icon size={19} aria-hidden="true"/>{item.label}
          {item.id === 'orders' && newOrders > 0 && <span className="admin-nav-badge">{formatNumber(newOrders)}
            <span className="sr-only"> سفارش جدید در انتظار رسیدگی</span></span>}</button>)}
      </nav>
      <div className="admin-side-spacer"/>
      <div className="admin-side-note">
        <strong>فضای مدیریت اختصاصی</strong>
        <span>هر تغییر مهم با نام حساب شما در تاریخچه ثبت می‌شود.</span>
        <Link href="/" target="_blank" rel="noopener noreferrer"><ExternalLink size={13} aria-hidden="true"/> مشاهده فروشگاه
          <span className="sr-only">(در زبانه جدید)</span></Link>
      </div>
      <button type="button" className="admin-signout" onClick={() => void signOut()}>
        <LogOut size={18} aria-hidden="true"/> خروج از حساب</button>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <div><h1 className="admin-page-title" ref={heading} tabIndex={-1}>{section.title}</h1>
          <p className="admin-page-subtitle">کسری بوتیک / پنل مدیریت</p>
        </div>
        <div className="admin-account">
          <div>
            <span className="admin-account-name">{user.displayName}</span>
            <span className="admin-account-role">{user.customRoleName ?? ROLE[user.role]}</span>
          </div>
          <div className="admin-avatar" aria-hidden="true">{user.displayName.slice(0, 1)}</div>
        </div>
      </header>
      <div className="admin-main" id="admin-content" tabIndex={-1}>
        {view.section === 'overview' && <SalesOverview
          openProduct={can('products:read') ? id => go('products', id) : undefined}/>}
        {view.section === 'traffic' && <TrafficOverview/>}
        {view.section === 'products' && (editor !== null
          ? <ProductEditor key={editor} permissions={user.permissions} onUnsaved={setUnsaved} done={closeEditor}
            productId={editor === 'new' || editor.startsWith('copy:') ? undefined : editor}
            copyOf={editor.startsWith('copy:') ? editor.slice(5) : undefined}/>
          : <div className="admin-stack">
            {saved && <Notice tone="success">محصول ذخیره شد.</Notice>}
            <ProductList key={listVersion + ':' + view.q} permissions={user.permissions} initialQuery={view.q}
              edit={id => openEditor(id)} create={() => openEditor('new')} duplicate={id => openEditor('copy:' + id)}/>
          </div>)}
        {view.section === 'home' && <HomeSliderManager onUnsaved={setUnsaved}/>}
        {view.section === 'orders' && <OrderManager canFulfill={can('orders:fulfill')} canExport={can('orders:export')}/>}
        {view.section === 'staff' && <StaffManager/>}
        {view.section === 'audit' && <AuditLog/>}
        {view.section === 'account' && <AccountSettings user={user}/>}
      </div>
    </div>
  </div>;
}
