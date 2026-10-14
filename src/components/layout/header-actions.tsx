'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { SearchLauncher } from '@/components/search/search-launcher';
import { formatNumber } from '@/lib/format';

/** Header icons. Badges use Persian digits; cart changes after hydration are announced politely. */
export function HeaderActions() {
  const { cartCount, wishlist, hydrated } = useShop();
  const [announcement, setAnnouncement] = useState('');
  const [bump, setBump] = useState(false);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (previous.current !== null && previous.current !== cartCount) {
      setAnnouncement('سبد خرید: ' + formatNumber(cartCount) + ' کالا');
      if (cartCount > previous.current) {
        setBump(true);
        const timer = window.setTimeout(() => setBump(false), 400);
        previous.current = cartCount;
        return () => window.clearTimeout(timer);
      }
    }
    previous.current = cartCount;
  }, [cartCount, hydrated]);

  const cartLabel = 'سبد خرید' + (hydrated && cartCount ? '، ' + formatNumber(cartCount) + ' کالا' : '');
  const wishLabel = 'علاقه‌مندی‌ها' + (hydrated && wishlist.length ? '، ' + formatNumber(wishlist.length) + ' مورد' : '');

  return <div className="header-actions">
    <SearchLauncher />
    <Link className="icon-button header-wishlist" href="/wishlist" aria-label={wishLabel}>
      <Heart size={21} aria-hidden="true"/>
      {hydrated && wishlist.length > 0 && <span className="count" aria-hidden="true">{formatNumber(wishlist.length)}</span>}
    </Link>
    <Link className="icon-button" href="/cart" aria-label={cartLabel}>
      <ShoppingBag size={21} aria-hidden="true"/>
      {hydrated && cartCount > 0 && <span className="count" data-bump={bump} aria-hidden="true">{formatNumber(cartCount)}</span>}
    </Link>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
