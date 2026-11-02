'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Previous/next for the sale rail, for mouse users (CSS shows them only with a fine pointer that can hover; touch
 * screens swipe and keyboards tab through the cards). Each press moves by the cards that fit; a button is disabled
 * at its end. Both stay disabled (and hidden) until the rail has hydrated and measured itself: a button that cannot
 * act yet never looks pressable. They float over the photos, so appearing shifts nothing. */
export function SaleRailArrows({ trackId }: { trackId: string }) {
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });
  // Where a smooth scroll is headed. A second press while it runs continues from there, so a quick double press moves
  // two pages (a new scroll would otherwise start from wherever the first one has got to). Forgotten once the rail has
  // been still for a moment after a press; only a press or a scroll event starts that clock, never a measurement.
  const heading = useRef<number | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const forgetAfter = (ms: number) => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => { heading.current = null; }, ms);
  };

  useEffect(() => {
    const track = document.getElementById(trackId);
    if (!track) return;
    // RTL rails scroll from 0 toward negative offsets, so compare distances from the start.
    const measure = () => {
      const offset = Math.abs(track.scrollLeft), max = track.scrollWidth - track.clientWidth;
      setEdges({ atStart: offset <= 1, atEnd: offset >= max - 1 });
    };
    const onScroll = () => { measure(); if (heading.current !== null) forgetAfter(200); };
    measure();
    track.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(track);
    return () => { clearTimeout(settle.current); track.removeEventListener('scroll', onScroll); observer?.disconnect(); };
  }, [trackId]);

  function move(forward: boolean) {
    const track = document.getElementById(trackId);
    const card = track?.querySelector<HTMLElement>('.sale-card'), list = track?.querySelector('.sale-rail-list');
    if (!track || !card || !list) return;
    const step = card.offsetWidth + (parseFloat(getComputedStyle(list).columnGap) || 0);
    const distance = Math.max(1, Math.floor(track.clientWidth / step)) * step;
    // Forward is toward the inline end: the physical left in RTL, where offsets run from 0 down to -max.
    const rtl = getComputedStyle(track).direction === 'rtl', max = track.scrollWidth - track.clientWidth;
    const from = heading.current ?? track.scrollLeft;
    const to = Math.min(rtl ? 0 : max, Math.max(rtl ? -max : 0, from + (rtl ? -1 : 1) * (forward ? 1 : -1) * distance));
    heading.current = to;
    forgetAfter(1000);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: to, behavior: reduced ? 'instant' : 'smooth' });
  }

  return <div className="sale-rail-arrows">
    <button type="button" className="sale-rail-arrow" aria-label="تخفیف‌های قبلی" aria-controls={trackId}
      disabled={edges.atStart} onClick={() => move(false)}>
      <ChevronRight size={20} aria-hidden="true"/>
    </button>
    <button type="button" className="sale-rail-arrow" aria-label="تخفیف‌های بعدی" aria-controls={trackId}
      disabled={edges.atEnd} onClick={() => move(true)}>
      <ChevronLeft size={20} aria-hidden="true"/>
    </button>
  </div>;
}
