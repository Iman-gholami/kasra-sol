'use client';

import { useLayoutEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react';
import { digitsOnly, formatNumber, type Tone } from '@/components/admin/labels';

/** Digits grouped by thousands for an amount field: «1250000» → «1,250,000». */
export const groupDigits = (digits: string) => digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** An amount in toman, shown with thousands separators so «۱۲۵۰۰۰۰» reads as «1,250,000». It accepts Persian or Latin
 * digits, reports digits only, and keeps the caret after the same digit while the separators move. */
export function AmountInput({ value, onDigits, maxDigits = 10, ...props }:
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'maxLength'> & {
  value: string; onDigits: (digits: string) => void; maxDigits?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const shown = groupDigits(value);
  useLayoutEffect(() => {
    const input = ref.current;
    if (caret.current === null || !input || document.activeElement !== input) return;
    // Put the caret after the same number of digits as before the change.
    let seen = 0, at = 0;
    while (at < shown.length && seen < caret.current) { if (/\d/.test(shown[at])) seen++; at++; }
    input.setSelectionRange(at, at);
    caret.current = null;
  }, [shown]);
  return <input {...props} ref={ref} type="text" inputMode="numeric" dir="ltr" value={shown} onChange={event => {
    const { value: typed, selectionStart } = event.target;
    caret.current = digitsOnly(typed.slice(0, selectionStart ?? typed.length)).length;
    onDigits(digitsOnly(typed).replace(/^0+(?=\d)/, '').slice(0, maxDigits));
  }}/>;
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className="admin-badge" data-tone={tone}>{children}</span>;
}

/** Errors interrupt (role=alert); success and hints are polite status updates. */
export function Notice({ tone, children, className = '' }: { tone: 'error' | 'success' | 'warning' | 'info'; children: ReactNode; className?: string }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle;
  return <div role={tone === 'error' ? 'alert' : 'status'} className={'admin-notice ' + className} data-tone={tone}>
    <Icon size={18} aria-hidden="true"/><div>{children}</div>
  </div>;
}

export function Loading({ label }: { label: string }) {
  return <p role="status" className="admin-loading"><Loader2 size={18} aria-hidden="true" className="admin-spin"/>{label}</p>;
}

export function Pager({ page, pages, total, unit, onPage }: {
  page: number; pages: number; total: number; unit: string; onPage: (page: number) => void;
}) {
  return <nav className="admin-pager" aria-label="صفحه‌بندی">
    <p>{formatNumber(total)} {unit} · صفحه {formatNumber(page)} از {formatNumber(pages)}</p>
    <div>
      <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={page <= 1}
        onClick={() => onPage(page - 1)}><ChevronRight size={15} aria-hidden="true"/> قبلی</button>
      <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={page >= pages}
        onClick={() => onPage(page + 1)}>بعدی <ChevronLeft size={15} aria-hidden="true"/></button>
    </div>
  </nav>;
}
