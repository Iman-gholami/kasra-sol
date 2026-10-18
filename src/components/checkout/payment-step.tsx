'use client';

import { useRef, useState, type FormEvent, type RefObject } from 'react';
import Link from 'next/link';
import { AlertCircle, Banknote, CreditCard, Info, MapPin, Tag, Truck, X } from 'lucide-react';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { ChoiceCard, normalizeMobile, normalizePostal } from '@/components/checkout/fields';
import type { CheckoutDraft, DemoOrder } from '@/components/checkout/checkout-storage';
import { DEFAULT_PAYMENT, paymentById, paymentMethods, paymentRestriction, shippingById,
  type Line, type OrderTotals, type PaymentMethodId } from '@/lib/checkout';
import { toPersianDigits, toman } from '@/lib/format';
import { orderAttempt } from '@/lib/order-attempt';

type Outcome = 'failed' | 'cancelled' | null;

/** Step two: confirm the address and method, choose how to pay, then pay (a discount code comes from the cart).
 * Online payment opens a simulated gateway whose outcome the tester picks, so both the success and the
 * failure path can be designed and checked; no card data is ever asked for. */
export function PaymentStep({ draft, update, lines, totals, headingRef, onPlaced }: {
  draft: CheckoutDraft; update: (patch: Partial<CheckoutDraft>) => void; lines: Line[]; totals: OrderTotals;
  headingRef: RefObject<HTMLHeadingElement | null>; onPlaced: (order: DemoOrder) => void;
}) {
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const gatewayMounted = useMountedOnce(gatewayOpen);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState('');
  const submitting = useRef(false);
  const backendEnabled = process.env.NEXT_PUBLIC_BACKEND_ENABLED === 'true';
  const { fields } = draft;
  const shipping = shippingById(draft.shipping);
  const payment: PaymentMethodId = paymentRestriction(paymentById(draft.payment), draft.shipping) ? DEFAULT_PAYMENT : draft.payment;

  async function place(method: PaymentMethodId) {
    if (backendEnabled) {
      if (submitting.current) return;
      submitting.current = true;
      const payload = {
        items: lines.map(line => line.item),
        fields: { ...fields, mobile: normalizeMobile(fields.mobile), postal: normalizePostal(fields.postal) },
        shipping: draft.shipping, payment: method, code: totals.discount ? draft.code : ''
      };
      const fingerprint = JSON.stringify(payload);
      setSaving(true);
      setApiError('');
      try {
        const attempt = await orderAttempt(fingerprint);
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.key },
          body: fingerprint
        });
        const order = await response.json();
        if (!response.ok) throw new Error(order.message || 'ثبت سفارش ناموفق بود. موجودی یا اطلاعات را دوباره بررسی کن.');
        onPlaced({
          id: order.id, items: lines.map(line => line.item), fields: payload.fields,
          shipping: draft.shipping, payment: method, code: payload.code,
          totals: { ...totals, ...order.totals }, status: order.status
        });
      } catch (error) {
        submitting.current = false;
        setApiError(error instanceof Error ? error.message : 'ارتباط با سرور برقرار نشد.');
        setSaving(false);
      }
      return;
    }
    onPlaced({
      id: 'KS-' + String(Math.floor(100000 + Math.random() * 900000)),
      items: lines.map(line => line.item), fields, shipping: draft.shipping, payment: method,
      code: totals.discount ? draft.code : '', totals
    });
  }
  function closeGateway(result: Exclude<Outcome, null>) {
    setOutcome(result);
    setGatewayOpen(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOutcome(null);
    if (backendEnabled || payment === 'cod') void place(payment);
    else setGatewayOpen(true);
  }

  return <form className="checkout-card" onSubmit={submit} noValidate aria-labelledby="checkout-step-title">
    <div className="checkout-card-head">
      <h2 id="checkout-step-title" ref={headingRef} tabIndex={-1}>بازبینی و پرداخت</h2>
    </div>

    <section className="checkout-review" aria-label="اطلاعات ارسال">
      <div className="review-row">
        <MapPin size={20} aria-hidden="true"/>
        <div className="review-text">
          <p className="review-label">تحویل به</p>
          <p>{fields.name}، <bdi dir="ltr">{toPersianDigits(normalizeMobile(fields.mobile))}</bdi></p>
          <p className="review-muted">{fields.province}، {fields.city}، {fields.address}، کد پستی <bdi dir="ltr">{toPersianDigits(normalizePostal(fields.postal))}</bdi></p>
        </div>
        <Link href="/checkout" className="link-button" aria-label="ویرایش نشانی تحویل">ویرایش</Link>
      </div>
      <div className="review-row">
        <Truck size={20} aria-hidden="true"/>
        <div className="review-text">
          <p className="review-label">روش ارسال</p>
          <p>{shipping.title}، {shipping.eta}</p>
        </div>
        <Link href="/checkout#shipping-method" className="link-button" aria-label="تغییر روش ارسال">تغییر</Link>
      </div>
    </section>

    <fieldset className="choice-group">
      <legend className="checkout-section-title">روش پرداخت</legend>
      {paymentMethods.map(method => {
        const reason = paymentRestriction(method, draft.shipping);
        return <ChoiceCard key={method.id} name="payment" value={method.id} checked={payment === method.id}
          disabled={Boolean(reason)} title={method.title} detail={method.description} reason={reason}
          aside={method.id === 'online' ? <CreditCard size={22} aria-hidden="true"/> : <Banknote size={22} aria-hidden="true"/>}
          onChange={() => { setOutcome(null); update({ payment: method.id }); }}/>;
      })}
    </fieldset>

    {totals.discount > 0 && <p className="checkout-code-note"><Tag size={16} aria-hidden="true"/>
      <span>کد تخفیف <bdi dir="ltr">{draft.code}</bdi> روی این سفارش اعمال شده است.</span></p>}

    <p className="checkout-submit-note">
      <Info size={15} aria-hidden="true"/>
      {payment === 'online'
        ? (backendEnabled ? 'سفارش در سرور ثبت می‌شود، اما پرداخت اینترنتی تا اتصال درگاه واقعی انجام نخواهد شد.' : 'به درگاه پرداخت آزمایشی می‌روی؛ در هیچ مرحله‌ای اطلاعات کارت بانکی پرسیده نمی‌شود.')
        : 'مبلغ ' + toman(totals.total) + ' را هنگام تحویل با کارت‌خوان پرداخت می‌کنی.'}
    </p>
    <div className="checkout-submit-bar">
      {apiError && <p className="status-message checkout-outcome error" role="alert"><AlertCircle size={18} aria-hidden="true"/>{apiError}</p>}
      {outcome && <p className={'status-message checkout-outcome' + (outcome === 'failed' ? ' error' : ' is-neutral')}
        role={outcome === 'failed' ? 'alert' : 'status'}>
        <AlertCircle size={18} aria-hidden="true"/>
        <span>{outcome === 'failed'
          ? 'پرداخت انجام نشد. سبد خریدت محفوظ است؛ دوباره تلاش کن یا روش پرداخت دیگری انتخاب کن.'
          : 'پرداخت را لغو کردی. سبد خریدت محفوظ است و هر وقت آماده بودی می‌توانی دوباره پرداخت کنی.'}</span>
      </p>}
      <button className="btn btn-primary btn-lg btn-block form-submit" type="submit" disabled={saving}>
        {saving ? 'در حال ثبت سفارش...' : backendEnabled && payment === 'online' ? 'ثبت سفارش در انتظار پرداخت' :
          payment === 'online' ? <>پرداخت <span className="price">{toman(totals.total)}</span></> : 'ثبت نهایی سفارش'}
      </button>
    </div>

    {!backendEnabled && gatewayMounted && <Sheet open={gatewayOpen} onClose={() => closeGateway('cancelled')} labelledBy="gateway-title"
      className="sheet-center gateway-dialog">
      <div className="sheet-inner">
        <div className="sheet-header">
          <div>
            <p className="gateway-kicker">درگاه پرداخت آزمایشی</p>
            <h2 className="sheet-title" id="gateway-title">پرداخت سفارش کسری بوتیک</h2>
          </div>
          <button type="button" className="icon-button" aria-label="انصراف از پرداخت" onClick={() => closeGateway('cancelled')}>
            <X size={22} aria-hidden="true"/>
          </button>
        </div>
        <div className="sheet-body gateway-body">
          <dl className="gateway-facts">
            <div><dt>پذیرنده</dt><dd>کسری بوتیک (نمایشی)</dd></div>
            <div><dt>مبلغ قابل پرداخت</dt><dd className="price">{toman(totals.total)}</dd></div>
          </dl>
          <p className="notice"><Info size={18} aria-hidden="true"/>
            <span>این درگاه شبیه‌سازی است و هیچ اطلاعات کارت بانکی نمی‌گیرد. برای آزمایش، نتیجه پرداخت را انتخاب کن.</span></p>
        </div>
        <div className="sheet-footer gateway-actions">
          <button type="button" className="btn btn-primary btn-block" data-autofocus onClick={() => place('online')}>شبیه‌سازی پرداخت موفق</button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => closeGateway('failed')}>شبیه‌سازی پرداخت ناموفق</button>
        </div>
      </div>
    </Sheet>}
  </form>;
}
