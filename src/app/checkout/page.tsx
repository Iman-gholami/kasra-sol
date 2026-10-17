import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CheckoutFlowHeader, CheckoutPage, CheckoutSkeleton } from '@/components/checkout/checkout-page';
import { FlowHeader } from '@/components/checkout/flow-chrome';

export const metadata: Metadata = { title: 'تسویه‌حساب نمایشی', robots: { index: false, follow: false } };
export default function Page() {
  return <div className="container checkout-page">
    <Suspense fallback={<FlowHeader back="/cart" backLabel="بازگشت به سبد خرید"/>}>
      <CheckoutFlowHeader/>
    </Suspense>
    <h1 className="page-heading">ثبت سفارش</h1>
    {/* The step lives in the query string (?step=payment); reading it on the client keeps this route static. */}
    <Suspense fallback={<CheckoutSkeleton/>}>
      <CheckoutPage />
    </Suspense>
  </div>;
}
