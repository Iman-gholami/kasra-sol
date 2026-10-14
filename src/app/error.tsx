'use client';

import Link from 'next/link';
import { RotateCw } from 'lucide-react';

/** Route-level error boundary with a calm, actionable Persian message. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="container">
    <div className="confirmation" role="alert">
      <p className="section-kicker">مشکلی پیش آمد</p>
      <h1>این بخش الان باز نشد</h1>
      <p>ممکن است اتصال لحظه‌ای قطع شده باشد. یک بار دیگر امتحان کن؛ سبد خرید و علاقه‌مندی‌هایت در همین مرورگر محفوظ‌اند.</p>
      <div className="empty-actions">
        <button type="button" className="btn btn-primary" onClick={reset}><RotateCw size={18} aria-hidden="true"/> تلاش دوباره</button>
        <Link href="/" className="btn btn-secondary">صفحه اصلی</Link>
      </div>
    </div>
  </div>;
}
