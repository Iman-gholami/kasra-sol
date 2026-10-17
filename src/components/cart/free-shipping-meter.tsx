import { Truck } from 'lucide-react';
import { freeShippingProgress } from '@/lib/checkout';
import { toman } from '@/lib/format';

/** Calm progress toward free standard shipping. The sentence carries the meaning; the bar is decoration. */
export function FreeShippingMeter({ subtotal }: { subtotal: number }) {
  const { remaining, reached, ratio } = freeShippingProgress(subtotal);
  return <div className={'ship-meter' + (reached ? ' is-reached' : '')}>
    <p>
      <Truck size={18} aria-hidden="true"/>
      {reached
        ? <span>ارسال با پست پیشتاز برای این سفارش <strong>رایگان</strong> است.</span>
        : <span>با <strong className="price">{toman(remaining)}</strong> خرید دیگر، ارسال با پست پیشتاز رایگان می‌شود.</span>}
    </p>
    <span className="ship-meter-track" aria-hidden="true"><span style={{ inlineSize: Math.round(ratio * 100) + '%' }}/></span>
  </div>;
}
