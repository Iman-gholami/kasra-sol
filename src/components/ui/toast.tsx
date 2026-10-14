'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

type Toast = { id: number; message: string; action?: { label: string; href: string } };
type Notify = (toast: Omit<Toast, 'id'>) => void;

const ToastContext = createContext<Notify>(() => {});
const DURATION = 6000;

/** Non-blocking confirmations for non-modal contexts (e.g. saving to the wishlist from a card).
 * One toast at a time, polite live region, pauses while hovered or focused. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [paused, setPaused] = useState(false);
  const counter = useRef(0);
  const notify = useCallback<Notify>(next => { counter.current += 1; setToast({ ...next, id: counter.current }); }, []);

  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(() => setToast(null), DURATION);
    return () => window.clearTimeout(timer);
  }, [toast, paused]);

  return <ToastContext.Provider value={notify}>
    {children}
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true"
      onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      {toast && <div className="toast" key={toast.id}>
        <span className="toast-message">{toast.message}</span>
        {toast.action && <Link href={toast.action.href} onClick={() => setToast(null)}>{toast.action.label}</Link>}
        <button type="button" className="icon-button" aria-label="بستن پیام" onClick={() => setToast(null)}><X size={18} aria-hidden="true"/></button>
      </div>}
    </div>
  </ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
