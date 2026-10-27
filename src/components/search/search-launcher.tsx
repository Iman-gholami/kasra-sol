'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Search } from 'lucide-react';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { SearchExperience } from '@/components/search/search-experience';

export const OPEN_SEARCH_EVENT = 'kasra:open-search';

/** Header search: a field-styled trigger on desktop, an icon on phones. Opens one combobox in an
 * anchored dropdown (desktop) or a full-screen overlay (phone). Also opened by "/" and the bottom nav. */
export function SearchLauncher() {
  const [open, setOpen] = useState(false);
  const mounted = useMountedOnce(open);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  function show(from?: HTMLElement | null) {
    opener.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : trigger.current);
    const header = document.querySelector('.site-header');
    const top = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 96;
    document.documentElement.style.setProperty('--anchor-top', top + 8 + 'px');
    // Synchronous commit keeps showModal() and input focus inside the user gesture (iOS keyboard).
    flushSync(() => setOpen(true));
  }

  useEffect(() => {
    const onRequest = (event: Event) => show(event instanceof CustomEvent ? event.detail?.opener : null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"], dialog[open]')) return;
      event.preventDefault();
      show(trigger.current);
    };
    window.addEventListener(OPEN_SEARCH_EVENT, onRequest);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener(OPEN_SEARCH_EVENT, onRequest); document.removeEventListener('keydown', onKey); };
  }, []);

  return <>
    <button type="button" ref={trigger} className="search-trigger" aria-expanded={open} aria-haspopup="dialog"
      onClick={event => show(event.currentTarget)}>
      <Search size={20} strokeWidth={1.75} aria-hidden="true"/>
      <span className="search-trigger-label">جستجوی محصولات</span>
      <kbd aria-hidden="true">/</kbd>
    </button>
    {mounted && <Sheet open={open} onClose={() => setOpen(false)} label="جستجو در محصولات کسری"
      className="sheet-dropdown sheet-search" initialFocus={input} returnFocus={() => opener.current ?? trigger.current}>
      <SearchExperience inputRef={input} onClose={() => setOpen(false)} active={open}/>
    </Sheet>}
  </>;
}
