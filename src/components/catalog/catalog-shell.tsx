'use client';

import { createContext, useCallback, useContext, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type Navigate = (href: string, mode?: 'push' | 'replace') => void;
const CatalogNavigation = createContext<{ navigate: Navigate; pending: boolean }>({
  navigate: href => { window.location.assign(href); }, pending: false
});

/** Client-side catalog navigation: same URLs as the GET forms, but no full reload, no scroll jump,
 * and a pending state on the results while the server renders the next page. */
export function CatalogShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback<Navigate>((href, mode = 'push') => {
    startTransition(() => {
      if (mode === 'replace') router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  }, [router]);
  return <CatalogNavigation.Provider value={{ navigate, pending }}>
    <div className="catalog-body" data-pending={pending || undefined} aria-busy={pending || undefined}>{children}</div>
  </CatalogNavigation.Provider>;
}

export const useCatalogNavigation = () => useContext(CatalogNavigation);
