'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CategoryRailItem = {
  slug: string;
  title: string;
  href: string;
  active: boolean;
  current: boolean;
};

export type CategoryRail = {
  key: string;
  label: string;
  accessibleName: string;
  items: CategoryRailItem[];
};

/** Two deliberately shallow, independently scrollable rows; never wrap categories.
 * RTL scroll origins are zero at the right edge in modern browsers. */
function Rail({ label, accessibleName, items }: Omit<CategoryRail, 'key'>) {
  const track = useRef<HTMLElement>(null);
  const [limits, setLimits] = useState({ previous: false, next: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const distance = Math.abs(el.scrollLeft);
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    setLimits(current => {
      const next = { previous: distance > 2, next: distance < max - 2 };
      return current.previous === next.previous && current.next === next.next ? current : next;
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    // Keep the active category visible when a visitor navigates directly to a
    // category deep in the rail. Do not change the page's vertical position.
    const active = el.querySelector<HTMLElement>('[data-active="true"]');
    if (active) {
      const trackRect = el.getBoundingClientRect();
      const itemRect = active.getBoundingClientRect();
      if (itemRect.left < trackRect.left || itemRect.right > trackRect.right) {
        const delta = itemRect.left < trackRect.left
          ? itemRect.left - trackRect.left - 10
          : itemRect.right - trackRect.right + 10;
        el.scrollLeft += delta;
      }
    }
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [items, measure]);

  const scroll = (forward: boolean) => {
    const el = track.current;
    if (!el) return;
    const amount = Math.max(220, Math.round(el.clientWidth * 0.7));
    el.scrollBy({ left: forward ? -amount : amount, behavior: 'smooth' });
  };

  return <div className="catalog-taxonomy-row">
    <span className="catalog-taxonomy-label">{label}</span>
    <nav ref={track} className="catalog-taxonomy-track" aria-label={accessibleName}
      tabIndex={0} onScroll={measure}>
      {items.map(item => <Link key={item.slug} href={item.href} prefetch={false}
        className="catalog-taxonomy-link"
        aria-current={item.current ? 'page' : undefined}
        data-active={item.active ? 'true' : undefined}>{item.title}</Link>)}
    </nav>
    <div className="catalog-taxonomy-buttons">
      <button type="button" className="catalog-taxonomy-step" aria-label={'موارد قبلی ' + label}
        disabled={!limits.previous} onClick={() => scroll(false)}>
        <ChevronRight size={17} aria-hidden="true"/>
      </button>
      <button type="button" className="catalog-taxonomy-step" aria-label={'موارد بعدی ' + label}
        disabled={!limits.next} onClick={() => scroll(true)}>
        <ChevronLeft size={17} aria-hidden="true"/>
      </button>
    </div>
  </div>;
}

export function CategoryNavigation({ rails }: { rails: CategoryRail[] }) {
  return <div className="catalog-taxonomy" aria-label="مرور دسته‌بندی‌ها">
    {rails.map(({ key, ...rail }) => <Rail key={key} {...rail}/>)}
  </div>;
}
