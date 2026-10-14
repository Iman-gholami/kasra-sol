'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, House, Search, ShoppingBag, Store, type LucideIcon } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { openSearch, useSearchOpen } from '@/components/search/search-launcher';
import { CountBadge, countLabel, useCountBump } from '@/components/layout/count-badge';
import { useBottomNav, useKeyboardFlag } from '@/components/ui/document-flags';

type Destination = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Routes inside this destination's section (marked current, but not as "the page"). */
  section?: string[];
  /** Badge source and the link's accessible name with its count. */
  count?: { source: 'cart' | 'wishlist'; name: string; unit: string };
};

/** Right to left in the RTL bar. Search is an action (opens the shared dialog); the rest are links. */
const DESTINATIONS: Destination[] = [
  { label: 'خانه', href: '/', icon: House },
  { label: 'فروشگاه', href: '/shop', icon: Store, section: ['/category/', '/product/'] },
  { label: 'جستجو', href: '/search', icon: Search },
  { label: 'علاقه‌مندی', href: '/wishlist', icon: Heart, count: { source: 'wishlist', name: 'علاقه‌مندی‌ها', unit: 'مورد' } },
  { label: 'سبد', href: '/cart', icon: ShoppingBag, count: { source: 'cart', name: 'سبد خرید', unit: 'کالا' } }
];

/** Checkout is a focused form with its own sticky submit bar and the keyboard up most of the time. */
const HIDDEN_ON = /^\/checkout\/?$/;

/** Active-state policy, derived from the route on every render (never stored):
 *  - the route is a destination (/, /shop, /search, /wishlist, /cart) → aria-current="page"
 *  - the route is inside the shop section (/category/…, /product/…) → فروشگاه gets aria-current="true"
 *  - anything else (content pages, order confirmation, 404) → no item is current. */
function currentState(item: Destination, pathname: string): 'page' | 'true' | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (path === item.href) return 'page';
  if (item.section?.some(prefix => path.startsWith(prefix))) return 'true';
  return undefined;
}

/** Phone-only (≤ 600px) primary navigation, fixed to the bottom on every route except checkout. Task bars
 * (product purchase bar, cart total) stack on top of it through the contract in styles/tokens.css. */
export function BottomNav() {
  const pathname = usePathname();
  const { cartCount, wishlist, hydrated } = useShop();
  const searchOpen = useSearchOpen();
  const counts = { cart: hydrated ? cartCount : 0, wishlist: hydrated ? wishlist.length : 0 };
  const cartBump = useCountBump(counts.cart, hydrated);
  const hidden = HIDDEN_ON.test(pathname);
  useBottomNav(!hidden);
  useKeyboardFlag(pathname);

  if (hidden) return null;

  return <nav className="bottom-nav" aria-label="ناوبری اصلی موبایل">
    <ul>
      {DESTINATIONS.map(item => {
        const Icon = item.icon;
        const current = currentState(item, pathname);
        const count = item.count ? counts[item.count.source] : 0;
        const icon = <span className="bottom-nav-icon">
          <Icon size={22} aria-hidden="true"/>
          {item.count && <CountBadge count={count} bump={item.count.source === 'cart' && cartBump}/>}
        </span>;

        if (item.href === '/search') return <li key={item.href}>
          <button type="button" className="bottom-nav-item" aria-haspopup="dialog" aria-expanded={searchOpen}
            aria-current={current} onClick={event => openSearch(event.currentTarget)}>
            {icon}<span>{item.label}</span>
          </button>
        </li>;

        return <li key={item.href}>
          <Link href={item.href} className="bottom-nav-item" aria-current={current}
            aria-label={item.count ? countLabel(item.count.name, count, item.count.unit) : undefined}>
            {icon}<span aria-hidden={item.count ? true : undefined}>{item.label}</span>
          </Link>
        </li>;
      })}
    </ul>
  </nav>;
}
