'use client';

import { useEffect } from 'react';

/** Document-level UI state as attributes on <html>, read by CSS. Cheaper to invalidate than
 * `html:has(...)` selectors, which make the whole document's style depend on any matching node. */

let openModals = 0;
/** Called by every modal sheet: locks page scroll and hides bottom bars while any modal is open. */
export function markModal(open: boolean) {
  openModals = Math.max(0, openModals + (open ? 1 : -1));
  if (openModals) document.documentElement.dataset.modalOpen = '';
  else delete document.documentElement.dataset.modalOpen;
}

/** Declares which fixed bottom bar this page shows, so the page reserves its height. */
export function useBottomBar(kind: 'nav' | 'pdp' | 'cart', active = true) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.bottomBar = kind;
    return () => { if (root.dataset.bottomBar === kind) delete root.dataset.bottomBar; };
  }, [kind, active]);
}
