'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isAdminPath } from '@/components/layout/store-chrome';

const PURCHASE_FLOW = /^\/(cart|checkout)\/?$/;

/** The cart and checkout form one focused purchase flow: on phones they replace the site header and footer
 * with their own back-and-logo header (CSS keys off `data-flow`). Set during the server render from the
 * pathname, so the chrome never swaps after hydration. */
export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="site-shell" data-flow={PURCHASE_FLOW.test(pathname) ? 'checkout' : undefined} data-admin={isAdminPath(pathname) ? 'true' : undefined}>{children}</div>;
}
