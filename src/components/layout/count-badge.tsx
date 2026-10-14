import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@/lib/format';

/** Count badge shared by the header and the bottom nav. Positioned absolutely, so appearing after the store
 * hydrates never moves anything. Hidden from assistive tech: the owning link's name carries the count. */
export function CountBadge({ count, bump = false }: { count: number; bump?: boolean }) {
  if (count <= 0) return null;
  return <span className="count" data-bump={bump || undefined} aria-hidden="true">{count > 99 ? formatNumber(99) + '+' : formatNumber(count)}</span>;
}

/** Accessible name for a counted link, e.g. «سبد خرید، ۲ کالا». */
export function countLabel(name: string, count: number, unit: string) {
  return count > 0 ? name + '، ' + formatNumber(count) + ' ' + unit : name;
}

/** True for a moment after `count` grows (never on the first hydrated value), to play the badge bump. */
export function useCountBump(count: number, ready: boolean) {
  const [bump, setBump] = useState(false);
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    const before = previous.current;
    previous.current = count;
    if (before === null || count <= before) { setBump(false); return; }
    setBump(true);
    const timer = window.setTimeout(() => setBump(false), 400);
    return () => window.clearTimeout(timer);
  }, [count, ready]);
  return bump;
}
