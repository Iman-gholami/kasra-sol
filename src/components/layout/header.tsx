import Link from 'next/link';
import { HeaderActions } from '@/components/layout/header-actions';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { PrimaryNav } from '@/components/layout/primary-nav';

/** Server shell; only the menu, primary nav state and the action icons hydrate. */
export function Header() {
  return <>
    <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
    <aside className="announcement" aria-label="وضعیت نسخه نمایشی">
      <p>نسخه نمایشی کسری بوتیک · پرداخت و ثبت سفارش واقعی فعال نیست</p>
    </aside>
    <header className="site-header">
      <div className="container header-inner">
        <div className="header-start">
          <MobileMenu />
          <Link href="/" className="brand" aria-label="کسری بوتیک، صفحه اصلی">
            <span className="brand-monogram" aria-hidden="true">K</span>
            <span className="brand-type" aria-hidden="true"><strong dir="ltr">KASRA</strong><small dir="ltr">BOUTIQUE</small></span>
          </Link>
        </div>
        <PrimaryNav />
        <HeaderActions />
      </div>
    </header>
  </>;
}
