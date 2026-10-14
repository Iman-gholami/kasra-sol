'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, House, LayoutGrid, Search, ShoppingBag } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { OPEN_SEARCH_EVENT } from '@/components/search/search-launcher';
import { formatNumber } from '@/lib/format';

/** Task pages own the bottom of the screen with their own action bar, so the bottom nav steps aside there. */
const TASK_PAGES = [/^\/product\//, /^\/cart\/?$/, /^\/checkout\/?$/];

/** Phone-only (≤ 600px) bottom navigation for browsing pages. */
export function BottomNav() {
  const pathname = usePathname();
  const { cartCount, wishlist, hydrated } = useShop();
  if (TASK_PAGES.some(pattern => pattern.test(pathname))) return null;
  const current = (match: boolean) => (match ? 'page' as const : undefined);

  // Page space is reserved in CSS (--bottom-bar-space), so the bar never covers the footer.
  return <nav className="bottom-nav" aria-label="ناوبری پایین صفحه">
      <ul>
        <li><Link href="/" aria-current={current(pathname === '/')}><House size={22} aria-hidden="true"/><span>خانه</span></Link></li>
        <li><Link href="/shop" aria-current={current(pathname === '/shop' || pathname.startsWith('/category/'))}>
          <LayoutGrid size={22} aria-hidden="true"/><span>دسته‌ها</span></Link></li>
        <li><button type="button" aria-haspopup="dialog" aria-current={current(pathname === '/search')}
          onClick={event => window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT, { detail: { opener: event.currentTarget } }))}>
          <Search size={22} aria-hidden="true"/><span>جستجو</span></button></li>
        <li><Link href="/wishlist" aria-current={current(pathname === '/wishlist')}
          aria-label={'علاقه‌مندی‌ها' + (hydrated && wishlist.length ? '، ' + formatNumber(wishlist.length) + ' مورد' : '')}>
          <span className="bottom-nav-icon"><Heart size={22} aria-hidden="true"/>
            {hydrated && wishlist.length > 0 && <span className="count" aria-hidden="true">{formatNumber(wishlist.length)}</span>}</span>
          <span aria-hidden="true">علاقه‌مندی</span></Link></li>
        <li><Link href="/cart" aria-label={'سبد خرید' + (hydrated && cartCount ? '، ' + formatNumber(cartCount) + ' کالا' : '')}>
          <span className="bottom-nav-icon"><ShoppingBag size={22} aria-hidden="true"/>
            {hydrated && cartCount > 0 && <span className="count" aria-hidden="true">{formatNumber(cartCount)}</span>}</span>
          <span aria-hidden="true">سبد خرید</span></Link></li>
      </ul>
    </nav>;
}
