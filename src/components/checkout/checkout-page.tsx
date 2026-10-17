'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { completeOrder, loadDraft, saveDraft, type CheckoutDraft, type DemoOrder } from '@/components/checkout/checkout-storage';
import { addressComplete } from '@/components/checkout/fields';
import { ShippingStep } from '@/components/checkout/shipping-step';
import { PaymentStep } from '@/components/checkout/payment-step';
import { Breakdown, SummaryLines } from '@/components/checkout/order-summary';
import { FlowHeader, FlowSteps } from '@/components/checkout/flow-chrome';
import { orderTotals, resolveLines, shippingById, type Line } from '@/lib/checkout';
import { formatNumber, toman } from '@/lib/format';

/** The phone header's back link follows the step: payment goes back to shipping, shipping to the cart. */
export function CheckoutFlowHeader() {
  const payment = useSearchParams().get('step') === 'payment';
  return payment
    ? <FlowHeader back="/checkout" backLabel="بازگشت به اطلاعات ارسال"/>
    : <FlowHeader back="/cart" backLabel="بازگشت به سبد خرید"/>;
}

export function CheckoutSkeleton() {
  return <div className="checkout-skeleton" role="status" aria-label="در حال بارگذاری تسویه‌حساب">
    <span className="skeleton" aria-hidden="true"/><span className="skeleton" aria-hidden="true"/>
  </div>;
}

/** Two steps — ۱ ارسال (address + shipping method), ۲ پرداخت (review, payment method, discount code) —
 * addressed by `?step=payment`, so browser Back returns to the previous step instead of leaving checkout. */
export function CheckoutPage() {
  const router = useRouter();
  const { cart, hydrated, clearCart } = useShop();
  const [placed, setPlaced] = useState(false);

  if (!hydrated || placed) return <CheckoutSkeleton/>;
  const lines = resolveLines(cart);
  if (!lines.length) return <div className="empty-state">
    <h2>سبد خرید خالی است</h2>
    <p>برای ثبت سفارش، اول لباسی را که دوست داری به سبد خرید اضافه کن.</p>
    <Link className="btn btn-primary" href="/shop">بازگشت به فروشگاه <ArrowLeft size={18} aria-hidden="true"/></Link>
  </div>;

  return <CheckoutFlow lines={lines} onPlaced={order => {
    // No customer information leaves the browser: the demo order is kept only in this tab's sessionStorage.
    completeOrder(order);
    setPlaced(true);
    clearCart();
    router.replace('/order-confirmation');
  }}/>;
}

function CheckoutFlow({ lines, onPlaced }: { lines: Line[]; onPlaced: (order: DemoOrder) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  // Mounted only after the cart store hydrates, so reading sessionStorage here never runs on the server.
  const [draft, setDraft] = useState<CheckoutDraft>(loadDraft);
  const heading = useRef<HTMLHeadingElement>(null);
  const wantsPayment = params.get('step') === 'payment';
  const step = wantsPayment && addressComplete(draft.fields) ? 'payment' : 'shipping';
  const shownStep = useRef(step);
  const totals = orderTotals(lines, draft.shipping, draft.code);
  const method = shippingById(draft.shipping);
  const update = (patch: Partial<CheckoutDraft>) => setDraft(current => ({ ...current, ...patch }));

  useEffect(() => { saveDraft(draft); }, [draft]);

  // A payment URL without a complete address (a fresh tab, a shared link) falls back to step one.
  useEffect(() => { if (wantsPayment && step === 'shipping') router.replace('/checkout'); }, [wantsPayment, step, router]);

  // On a step change, start at the top of the new step: focus its heading, or the anchored section.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    const anchor = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (anchor) {
      anchor.scrollIntoView({ block: 'start' });
      anchor.querySelector<HTMLElement>('input:checked')?.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      heading.current?.focus({ preventScroll: true });
    }
  }, [step]);

  const summary = <>
    <SummaryLines lines={lines}/>
    <Breakdown totals={totals} code={draft.code} total={totals.total} totalLabel="مبلغ قابل پرداخت"
      shipping={{ label: method.title, value: totals.shipping ? <span className="price">{toman(totals.shipping)}</span> : 'رایگان' }}/>
  </>;

  return <>
    <FlowSteps current={step === 'payment' ? 3 : 2}/>
    <details className="checkout-summary-mobile">
      <summary><span>خلاصه سفارش، {formatNumber(totals.units)} کالا</span><strong className="price">{toman(totals.total)}</strong></summary>
      <div className="checkout-summary-body">{summary}</div>
    </details>
    <div className="checkout-layout">
      {step === 'shipping'
        ? <ShippingStep draft={draft} update={update} subtotal={totals.subtotal} headingRef={heading}
          onContinue={() => router.push('/checkout?step=payment')}/>
        : <PaymentStep draft={draft} update={update} lines={lines} totals={totals} headingRef={heading} onPlaced={onPlaced}/>}
      <aside className="summary-card checkout-summary" aria-labelledby="checkout-summary-title">
        <h2 id="checkout-summary-title">خلاصه سفارش</h2>
        {summary}
      </aside>
    </div>
  </>;
}
