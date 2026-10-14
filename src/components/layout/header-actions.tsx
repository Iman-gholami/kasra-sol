'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { SearchLauncher } from '@/components/search/search-launcher';
import { CountBadge, countLabel, useCountBump } from '@/components/layout/count-badge';
import { formatNumber } from '@/lib/format';

/** Header icons. Badges use Persian digits; cart changes after hydration are announced politely here
 * (only here — the bottom nav shows the same count without a second announcement). */
export function HeaderActions() {
  const { cartCount, wishlist, hydrated } = useShop();
  const [announcement, setAnnouncement] = useState('');
  const previous = useRef<number | null>(null);
  const bump = useCountBump(cartCount, hydrated);

  useEffect(() => {
    if (!hydrated) return;
    if (previous.current !== null && previous.current !== cartCount) setAnnouncement('سبد خرید: ' + formatNumber(cartCount) + ' کالا');
    previous.current = cartCount;
  }, [cartCount, hydrated]);

  const cart = hydrated ? cartCount : 0;
  const saved = hydrated ? wishlist.length : 0;

  return <div className="header-actions">
    <SearchLauncher />
    <Link className="icon-button header-wishlist" href="/wishlist" aria-label={countLabel('علاقه‌مندی‌ها', saved, 'مورد')}>
      <Heart size={21} aria-hidden="true"/>
      <CountBadge count={saved}/>
    </Link>
    <Link className="icon-button header-cart" href="/cart" aria-label={countLabel('سبد خرید', cart, 'کالا')}>
      <ShoppingBag size={21} aria-hidden="true"/>
      <CountBadge count={cart} bump={bump}/>
    </Link>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
