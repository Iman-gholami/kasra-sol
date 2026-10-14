import type { Metadata } from 'next';
import { CheckoutPage } from '@/components/checkout/checkout-page';

export const metadata: Metadata = { title: 'تسویه‌حساب نمایشی', robots: { index: false, follow: false } };
export default function Page() {
  return <div className="container checkout-page">
    <h1 className="page-heading">تسویه‌حساب <span className="count-note">(فقط نمایش)</span></h1>
    <CheckoutPage />
  </div>;
}
