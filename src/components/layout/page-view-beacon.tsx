'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** Reports each storefront page shown to the shop's own statistics (no cookies, no third parties).
 * Only the path and, on the first page, the referring site are sent. */
export function PageViewBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    // Automated browsers (scrapers, test runners) announce themselves through navigator.webdriver.
    if (process.env.NEXT_PUBLIC_BACKEND_ENABLED !== 'true' || navigator.webdriver || last.current === pathname) return;
    const first = last.current === null;
    last.current = pathname;
    const body = JSON.stringify({ path: pathname, ...(first && document.referrer ? { referrer: document.referrer } : {}) });
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/analytics/view', blob))
      void fetch('/api/analytics/view', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
        .catch(() => undefined);
  }, [pathname]);
  return null;
}
