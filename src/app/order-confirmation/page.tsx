import type { Metadata } from 'next';
import { OrderConfirmation } from '@/components/checkout/order-confirmation';

export const metadata: Metadata = { title: 'تأیید نمایشی', robots: { index: false, follow: false } };
export default function Page() {
  return <div className="container">
    <OrderConfirmation/>
  </div>;
}
