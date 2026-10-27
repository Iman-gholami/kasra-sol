import Link from 'next/link';
import { HeaderActions } from '@/components/layout/header-actions';
import { MobileMenu } from '@/components/layout/mobile-menu';
import { PrimaryNav } from '@/components/layout/primary-nav';
import { Wordmark } from '@/components/layout/wordmark';

/** Server shell; only the menu, primary nav state and the action icons hydrate.
 * Masthead layout: navigation at the inline start, the wordmark centred, actions at the end. The start group
 * holds the menu button (phones and tablets) or the desktop navigation, so the DOM order matches the visual one. */
export function Header() {
  return <>
    <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
    <aside className="announcement" aria-label="وضعیت نسخه نمایشی">
      <p>{process.env.NEXT_PUBLIC_BACKEND_ENABLED === 'true'
        ? 'نسخه آزمایشی کسری بوتیک · سفارش در سرور ثبت می‌شود، پرداخت اینترنتی هنوز فعال نیست'
        : 'نسخه نمایشی · خرید واقعی فعال نیست'}</p>
    </aside>
    <header className="site-header">
      <div className="container header-inner">
        <div className="header-start">
          <MobileMenu />
          <PrimaryNav />
        </div>
        <Link href="/" className="brand" aria-label="کسری بوتیک، صفحه اصلی"><Wordmark/></Link>
        <HeaderActions />
      </div>
    </header>
  </>;
}
