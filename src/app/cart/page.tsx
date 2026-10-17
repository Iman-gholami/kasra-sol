import type { Metadata } from 'next';
import { CartPage } from '@/components/cart/cart-page';
import { FlowHeader } from '@/components/checkout/flow-chrome';

export const metadata: Metadata = { title: 'سبد خرید', robots: { index: false, follow: false } };
export default function Page() {
  return <div className="container cart-page">
    <FlowHeader back="/shop" backLabel="بازگشت به فروشگاه"/>
    <h1 className="page-heading">سبد خرید</h1>
    <CartPage />
  </div>;
}
