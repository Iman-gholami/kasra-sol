'use client';

import { useEffect, type RefObject } from 'react';

/** Document-level UI state as attributes on <html>, read by CSS. Cheaper to invalidate than
 * `html:has(...)` selectors, which make the whole document's style depend on any matching node.
 * The bottom-of-screen terms these flags switch on are documented in styles/tokens.css. */

let openModals = 0;
/** Called by every modal sheet: locks page scroll and hides the fixed bottom layers while any modal is open. */
export function markModal(open: boolean) {
  openModals = Math.max(0, openModals + (open ? 1 : -1));
  if (openModals) document.documentElement.dataset.modalOpen = '';
  else delete document.documentElement.dataset.modalOpen;
}

/** Declares that the phone bottom nav is shown, so the page reserves its height and task bars stack above it. */
export function useBottomNav(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.bottomNav = '';
    return () => { delete root.dataset.bottomNav; };
  }, [active]);
}

/** Declares the page's fixed task bar (product purchase bar, cart total) and publishes its content height,
 * so the page reserves exactly that space above the bottom nav. Padding and the safe area are added in CSS. */
export function useTaskBar(kind: 'pdp' | 'cart', bar: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    const node = bar.current;
    if (!active || !node) return;
    const root = document.documentElement;
    root.dataset.taskBar = kind;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([entry]) => {
      // contentRect excludes padding; 0 means the bar is not laid out (desktop), so keep the CSS fallback.
      if (entry.contentRect.height) root.style.setProperty('--task-bar-content-h', entry.contentRect.height + 'px');
    });
    observer?.observe(node);
    return () => {
      observer?.disconnect();
      if (root.dataset.taskBar !== kind) return;
      delete root.dataset.taskBar;
      root.style.removeProperty('--task-bar-content-h');
    };
  }, [kind, bar, active]);
}

const TEXT_ENTRY = 'input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=reset],[type=range],[type=color],[type=file],[type=image]),textarea,[contenteditable=""],[contenteditable="true"]';
// Fields inside a modal are left out: the modal flag already hides the bars, and a stale keyboard flag would
// keep the nav hidden (unfocusable) at the moment the closing dialog returns focus to a nav button.
const isTextEntry = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.matches(TEXT_ENTRY) && !target.closest('dialog');

/** Marks <html data-keyboard> while a text field in the page has focus. On phones the on-screen keyboard is
 * then up, and fixed bottom layers would cover the field or ride on top of it, so CSS hides them until it closes.
 * Moving focus between two fields fires focusout then focusin in the same task, so nothing flickers. */
export function useKeyboardFlag(routeKey: string) {
  useEffect(() => {
    const root = document.documentElement;
    const onFocusIn = (event: FocusEvent) => { if (isTextEntry(event.target)) root.dataset.keyboard = ''; };
    const onFocusOut = (event: FocusEvent) => { if (isTextEntry(event.target)) delete root.dataset.keyboard; };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      delete root.dataset.keyboard;
    };
  }, []);

  // A focused field that navigation removes does not reliably fire focusout; re-check on every route change.
  useEffect(() => {
    if (!isTextEntry(document.activeElement)) delete document.documentElement.dataset.keyboard;
  }, [routeKey]);
}
