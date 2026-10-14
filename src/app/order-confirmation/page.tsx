import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
export const metadata: Metadata = { title: 'تأیید نمایشی', robots: { index: false, follow: false } };
export default function Page() {
  return <div className="container">
    <div className="confirmation">
      <CheckCircle2 size={48} strokeWidth={1.3} aria-hidden="true"/>
      <p className="section-kicker">پایان آزمایش</p>
      <h1>فرایند نمایشی تمام شد!</h1>
      <p>این صفحه تنها پایان یک تجربه آزمایشی است. هیچ سفارشی ثبت نشده، هیچ پرداختی انجام نشده و اطلاعات دریافت‌کننده جایی ذخیره نشده‌اند.</p>
      <div className="empty-actions">
        <Link href="/shop" className="btn btn-primary">ادامه تماشای محصولات <ArrowLeft size={18} aria-hidden="true"/></Link>
        <Link href="/" className="btn btn-secondary">صفحه اصلی</Link>
      </div>
    </div>
  </div>;
}
