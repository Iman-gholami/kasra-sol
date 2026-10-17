'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useLastOrder } from '@/components/checkout/checkout-storage';
import { normalizeMobile, normalizePostal } from '@/components/checkout/fields';
import { Breakdown, SummaryLines } from '@/components/checkout/order-summary';
import { paymentById, resolveLines, shippingById } from '@/lib/checkout';
import { toPersianDigits, toman } from '@/lib/format';

/** Shows the demo order this tab just completed (kept only in sessionStorage); a direct visit without one
 * gets the generic end-of-demo message. The wording never claims a real order or payment. */
export function OrderConfirmation() {
  const order = useLastOrder();
  if (order === undefined) return <div className="confirmation-skeleton" role="status" aria-label="در حال بارگذاری نتیجه سفارش">
    <span className="skeleton" aria-hidden="true"/>
  </div>;
  if (!order) return <div className="confirmation">
    <CheckCircle2 size={48} strokeWidth={1.3} aria-hidden="true"/>
    <p className="section-kicker">پایان آزمایش</p>
    <h1>فرایند نمایشی تمام شد!</h1>
    <p>این صفحه تنها پایان یک تجربه آزمایشی است. هیچ سفارشی ثبت نشده، هیچ پرداختی انجام نشده و اطلاعات دریافت‌کننده جایی ذخیره نشده‌اند.</p>
    <div className="empty-actions">
      <Link href="/shop" className="btn btn-primary">ادامه تماشای محصولات <ArrowLeft size={18} aria-hidden="true"/></Link>
      <Link href="/" className="btn btn-secondary">صفحه اصلی</Link>
    </div>
  </div>;

  const { fields, totals } = order;
  const shipping = shippingById(order.shipping);
  const payment = paymentById(order.payment);
  const lines = resolveLines(order.items);
  const mobile = toPersianDigits(normalizeMobile(fields.mobile));
  const steps = ['ثبت سفارش', 'آماده‌سازی و بسته‌بندی', 'تحویل به ' + shipping.title, 'تحویل به تو'];

  return <div className="order-done">
    <header className="order-done-head">
      <CheckCircle2 size={48} strokeWidth={1.3} aria-hidden="true"/>
      <p className="section-kicker">سفارش آزمایشی</p>
      <h1>{order.payment === 'online' ? 'پرداخت آزمایشی موفق بود' : 'سفارش آزمایشی ثبت شد'}</h1>
      <p className="order-done-code">کد پیگیری آزمایشی: <strong><bdi dir="ltr">{toPersianDigits(order.id)}</bdi></strong></p>
      <p>در فروشگاه واقعی، پیامک تأیید و پیگیری به <bdi dir="ltr">{mobile}</bdi> فرستاده می‌شد.
        این نسخه نمایشی است: هیچ سفارش واقعی ثبت نشده و هیچ پرداختی انجام نشده است.</p>
    </header>

    <ol className="order-timeline" aria-label="مراحل سفارش">
      {steps.map((step, index) => <li key={step} data-done={index === 0 ? 'true' : undefined} aria-current={index === 0 ? 'step' : undefined}>
        <span aria-hidden="true">{toPersianDigits(String(index + 1))}</span>{step}
      </li>)}
    </ol>

    <div className="order-done-grid">
      <section className="order-card" aria-labelledby="order-shipping-title">
        <h2 id="order-shipping-title">ارسال</h2>
        <p><strong>{fields.name}</strong>، <bdi dir="ltr">{mobile}</bdi></p>
        <p className="review-muted">{fields.province}، {fields.city}، {fields.address}، کد پستی <bdi dir="ltr">{toPersianDigits(normalizePostal(fields.postal))}</bdi></p>
        <p>{shipping.title}، زمان تقریبی تحویل: {shipping.eta}</p>
      </section>
      <section className="order-card" aria-labelledby="order-payment-title">
        <h2 id="order-payment-title">پرداخت</h2>
        <p>{payment.title}{order.payment === 'cod' && '، ' + toman(totals.total) + ' هنگام تحویل'}</p>
        <Breakdown totals={totals} code={order.code} total={totals.total}
          totalLabel={order.payment === 'online' ? 'مبلغ پرداخت‌شده (آزمایشی)' : 'قابل پرداخت هنگام تحویل'}
          shipping={{ label: shipping.title, value: totals.shipping ? <span className="price">{toman(totals.shipping)}</span> : 'رایگان' }}/>
      </section>
      <section className="order-card order-card-wide" aria-labelledby="order-items-title">
        <h2 id="order-items-title">اقلام سفارش</h2>
        <SummaryLines lines={lines}/>
      </section>
    </div>

    <div className="empty-actions">
      <Link href="/shop" className="btn btn-primary">ادامه خرید <ArrowLeft size={18} aria-hidden="true"/></Link>
      <Link href="/" className="btn btn-secondary">صفحه اصلی</Link>
    </div>
  </div>;
}
