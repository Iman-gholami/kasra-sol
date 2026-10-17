'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, ExternalLink, LayoutDashboard, LogOut, Package, ScrollText, UserCog, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/components/admin/admin-api';
import { ROLE } from '@/components/admin/labels';
import { ProductEditor } from '@/components/admin/product-editor';
import { ProductList } from '@/components/admin/product-list';
import { SalesOverview } from '@/components/admin/sales-overview';
import { OrderManager } from '@/components/admin/order-manager';
import { StaffManager } from '@/components/admin/staff-manager';
import { AuditLog } from '@/components/admin/audit-log';
import { AccountSettings } from '@/components/admin/account-settings';

export type AdminUser = {
  id: string; username: string; displayName: string; role: 'owner' | 'manager' | 'staff';
  active: boolean; grants: string[]; revokes: string[]; permissions: string[];
};
export type Section = 'overview' | 'products' | 'orders' | 'staff' | 'audit' | 'account';
// The menu mirrors the API's permissions; the API still enforces every one of them on each request.
const SECTIONS: { id: Section; label: string; title: string; permission: string | null; icon: typeof Package }[] = [
  { id: 'overview', label: 'داشبورد', title: 'داشبورد فروشگاه', permission: 'reports:read', icon: LayoutDashboard },
  { id: 'products', label: 'محصولات و موجودی', title: 'محصولات و موجودی', permission: 'products:read', icon: Package },
  { id: 'orders', label: 'سفارش‌ها', title: 'مدیریت سفارش‌ها', permission: 'orders:read', icon: ClipboardList },
  { id: 'staff', label: 'کارکنان و مجوزها', title: 'کارکنان و مجوزها', permission: 'staff:manage', icon: UsersRound },
  { id: 'audit', label: 'تاریخچه فعالیت‌ها', title: 'تاریخچه فعالیت‌ها', permission: 'staff:manage', icon: ScrollText },
  { id: 'account', label: 'حساب من', title: 'حساب من', permission: null, icon: UserCog }
];

export function AdminDashboard({ user, initialSection }: { user: AdminUser; initialSection?: string }) {
  const router = useRouter();
  const allowed = SECTIONS.filter(item => !item.permission || user.permissions.includes(item.permission));
  const [section, setSection] = useState<Section>(() =>
    allowed.find(item => item.id === initialSection)?.id ?? allowed[0].id);
  const [productEditor, setProductEditor] = useState<string | 'new' | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const can = (permission: string) => user.permissions.includes(permission);

  useEffect(() => {
    const expired = () => router.replace('/admin/login?expired=1');
    window.addEventListener('kasra-admin-unauthorized', expired);
    return () => window.removeEventListener('kasra-admin-unauthorized', expired);
  }, [router]);

  function go(next: Section) {
    setSection(next); setProductEditor(null);
    window.history.replaceState(null, '', '/admin?tab=' + next);
    // Screen readers and keyboard users land on the new section's heading instead of staying in the menu.
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function signOut() {
    try { await adminApi('auth/logout', { method: 'POST' }); } catch { /* the cookie is cleared regardless */ }
    router.replace('/admin/login'); router.refresh();
  }
  const current = SECTIONS.find(item => item.id === section)!;
  return <div className="admin-app" data-testid="admin-app">
    <a className="skip-link" href="#admin-content">رفتن به محتوای اصلی</a>
    <aside className="admin-sidebar" aria-label="منوی پنل مدیریت">
      <div className="admin-brand">
        <span className="admin-brand-mark" aria-hidden="true">K</span>
        <div><p className="admin-brand-title">کسری بوتیک</p><p className="admin-brand-subtitle">پنل مدیریت فروشگاه</p></div>
      </div>
      <p className="admin-nav-head" aria-hidden="true">منوی اصلی</p>
      <nav className="admin-navigation" aria-label="بخش‌های مدیریت">
        {allowed.map(item => <button type="button" key={item.id} aria-current={section === item.id ? 'page' : undefined}
          onClick={() => go(item.id)}><item.icon size={19} aria-hidden="true"/>{item.label}</button>)}
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
        <div><h1 className="admin-page-title" ref={heading} tabIndex={-1}>{current.title}</h1>
          <p className="admin-page-subtitle">کسری بوتیک / پنل مدیریت</p>
        </div>
        <div className="admin-account">
          <div>
            <span className="admin-account-name">{user.displayName}</span>
            <span className="admin-account-role">{ROLE[user.role]}</span>
          </div>
          <div className="admin-avatar" aria-hidden="true">{user.displayName.slice(0, 1)}</div>
        </div>
      </header>
      <div className="admin-main" id="admin-content" tabIndex={-1}>
        {section === 'overview' && <SalesOverview/>}
        {section === 'products' && (productEditor !== null
          ? <ProductEditor productId={productEditor === 'new' ? undefined : productEditor} permissions={user.permissions}
            done={saved => { setProductEditor(null); if (saved) setListVersion(v => v + 1); }}/>
          : <ProductList key={listVersion} permissions={user.permissions}
            edit={setProductEditor} create={() => setProductEditor('new')}/>)}
        {section === 'orders' && <OrderManager canFulfill={can('orders:fulfill')}/>}
        {section === 'staff' && <StaffManager/>}
        {section === 'audit' && <AuditLog/>}
        {section === 'account' && <AccountSettings user={user}/>}
      </div>
    </div>
  </div>;
}
