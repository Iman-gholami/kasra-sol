import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
export const metadata: Metadata = { title: 'تأیید نمایشی', robots: { index: false, follow: false } };
export default function Page() {
  return <div className="container"><div className="confirmation"><CheckCircle2 size={48} strokeWidth={1.3} color="#8d7667" style={{margin:'0 auto'}} />
    <p className="eyebrow" style={{textAlign:'center'}}>DEMO COMPLETE</p><h1>فرایند نمایشی تمام شد!</h1>
    <p>این صفحه تنها پایان یک تجربه آزمایشی است. هیچ سفارشی ثبت نشده، هیچ پرداختی انجام نشده و اطلاعات دریافت‌کننده جایی ذخیره نشده‌اند.</p>
    <Link href="/shop" className="btn btn-dark">ادامه تماشای محصولات</Link>
  </div></div>;
}
