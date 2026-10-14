'use client';

import { Search } from 'lucide-react';
import { openSearch, useSearchOpen } from '@/components/search/search-launcher';

/** Homepage search entry (phones). A button styled as a field: it opens the shared search dialog, which owns
 * the real input and focuses it inside this tap (so iOS raises the keyboard), rather than posing as an input. */
export function HomeSearchEntry() {
  const open = useSearchOpen();
  return <button type="button" className="home-search-trigger" aria-haspopup="dialog" aria-expanded={open}
    onClick={event => openSearch(event.currentTarget)}>
    <Search size={19} aria-hidden="true"/>
    <span>دنبال چه لباسی می‌گردی؟</span>
  </button>;
}
