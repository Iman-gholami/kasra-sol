'use client';

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';

type Swipe = 'down' | 'start' | 'end';

type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** Accessible name when no visible title is referenced. */
  label?: string;
  labelledBy?: string;
  className: string;
  children: ReactNode;
  /** Element to focus after opening (defaults to `[data-autofocus]`, else the browser's dialog focusing steps). */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Element to focus after closing (defaults to whatever had focus before opening). */
  returnFocus?: () => HTMLElement | null | undefined;
  /** Gesture that dismisses the sheet; drag starts on `[data-sheet-drag]` for `down`, anywhere for drawers. */
  swipe?: Swipe;
  id?: string;
};

/** Native modal <dialog>: top layer, inert background, Escape via `cancel`, CSS enter/exit motion.
 * Every overlay in the store (menu, filters, search, quick cart, size guide, zoom) uses this. */
export function Sheet({ open, onClose, label, labelledBy, className, children, initialFocus, returnFocus, swipe, id }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const latest = useRef({ onClose, returnFocus, initialFocus });
  const drag = useRef<{ x: number; y: number; t: number; active: boolean; delta: number } | null>(null);

  useLayoutEffect(() => { latest.current = { onClose, returnFocus, initialFocus }; });

  // Layout effect: when the opener uses flushSync, showModal() and focus happen inside the user
  // gesture, which iOS Safari requires to raise the on-screen keyboard for search.
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      node.showModal();
      const target = latest.current.initialFocus?.current ?? node.querySelector<HTMLElement>('[data-autofocus]');
      target?.focus({ preventScroll: true });
    } else if (!open && node.open) {
      node.close();
      const back = latest.current.returnFocus?.() ?? previous.current;
      if (back?.isConnected) back.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => () => { if (dialog.current?.open) dialog.current.close(); }, []);

  function setDrag(value: number) {
    const node = dialog.current;
    if (!node) return;
    const sign = getComputedStyle(node).direction === 'rtl' ? 1 : -1;
    node.style.setProperty('--sheet-drag-y', swipe === 'down' ? value + 'px' : '0px');
    node.style.setProperty('--sheet-drag-x', swipe === 'start' ? value * sign + 'px' : swipe === 'end' ? -value * sign + 'px' : '0px');
  }

  function onPointerDown(event: PointerEvent<HTMLDialogElement>) {
    if (!swipe || event.pointerType === 'mouse') return;
    const target = event.target as HTMLElement;
    if (swipe === 'down' && !target.closest('[data-sheet-drag]')) return;
    if (target.closest('input, select, textarea, [data-no-swipe]')) return;
    drag.current = { x: event.clientX, y: event.clientY, t: performance.now(), active: false, delta: 0 };
  }

  function onPointerMove(event: PointerEvent<HTMLDialogElement>) {
    const state = drag.current;
    const node = dialog.current;
    if (!state || !node) return;
    const rtl = getComputedStyle(node).direction === 'rtl';
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    // Distance travelled toward the edge the sheet came from.
    const toward = swipe === 'down' ? dy : swipe === 'start' ? (rtl ? dx : -dx) : (rtl ? -dx : dx);
    const across = swipe === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (!state.active) {
      if (across > 10 && across > Math.abs(toward)) { drag.current = null; return; }
      if (toward < 8) return;
      state.active = true;
      node.dataset.dragging = 'true';
      node.setPointerCapture?.(event.pointerId);
    }
    state.delta = Math.max(0, toward);
    setDrag(state.delta);
  }

  function onPointerEnd() {
    const state = drag.current;
    const node = dialog.current;
    drag.current = null;
    if (!state?.active || !node) return;
    const size = swipe === 'down' ? node.offsetHeight : node.offsetWidth;
    const velocity = state.delta / Math.max(1, performance.now() - state.t);
    delete node.dataset.dragging;
    setDrag(0);
    if (state.delta > Math.min(120, size * 0.28) || velocity > 0.65) latest.current.onClose();
  }

  return <dialog ref={dialog} id={id} className={'sheet ' + className}
    aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy}
    onCancel={event => { event.preventDefault(); latest.current.onClose(); }}
    onClose={() => { if (open) latest.current.onClose(); }}
    onClick={event => {
      const node = dialog.current;
      if (!node || event.target !== node) return;
      const r = node.getBoundingClientRect();
      const outside = event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
      if (outside) latest.current.onClose();
    }}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
    {children}
  </dialog>;
}

/** Mount an overlay on first use and keep it mounted so its exit transition can play. */
export function useMountedOnce(open: boolean) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  return mounted;
}
