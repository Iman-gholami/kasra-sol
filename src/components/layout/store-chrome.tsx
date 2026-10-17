'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

/** Storefront header, footer, bottom navigation and cart sheet are not part of the private back office,
 * so they are not rendered there at all (not merely hidden with CSS). */
export function StoreChrome({ children }: { children: ReactNode }) {
  return isAdminPath(usePathname()) ? null : <>{children}</>;
}
