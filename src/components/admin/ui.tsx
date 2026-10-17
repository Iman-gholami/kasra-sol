'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react';
import { formatNumber, type Tone } from '@/components/admin/labels';

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
