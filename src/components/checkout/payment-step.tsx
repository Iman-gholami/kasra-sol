'use client';

import { useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import Link from 'next/link';
import { AlertCircle, Banknote, CreditCard, Info, MapPin, Tag, Truck, X } from 'lucide-react';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { ChoiceCard, normalizeMobile, normalizePostal } from '@/components/checkout/fields';
import type { CheckoutDraft, DemoOrder } from '@/components/checkout/checkout-storage';
import { DEFAULT_PAYMENT, applyDiscount, discountCodes, paymentById, paymentMethods, paymentRestriction, shippingById,
  type Line, type OrderTotals, type PaymentMethodId } from '@/lib/checkout';
import { toPersianDigits, toman } from '@/lib/format';

type Outcome = 'failed' | 'cancelled' | null;

/** Step two: confirm the address and method, choose how to pay, optionally apply a code, then pay.
 * Online payment opens a simulated gateway whose outcome the tester picks, so both the success and the
 * failure path can be designed and checked; no card data is ever asked for. */
export function PaymentStep({ draft, update, lines, totals, headingRef, onPlaced }: {
  draft: CheckoutDraft; update: (patch: Partial<CheckoutDraft>) => void; lines: Line[]; totals: OrderTotals;
  headingRef: RefObject<HTMLHeadingElement | null>; onPlaced: (order: DemoOrder) => void;
}) {
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const gatewayMounted = useMountedOnce(gatewayOpen);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const { fields } = draft;
  const shipping = shippingById(draft.shipping);
  const payment: PaymentMethodId = paymentRestriction(paymentById(draft.payment), draft.shipping) ? DEFAULT_PAYMENT : draft.payment;

  function place(method: PaymentMethodId) {
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
    if (payment === 'cod') place('cod');
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

    <DiscountField applied={draft.code} subtotal={totals.subtotal} onChange={code => update({ code })}/>

    <p className="checkout-submit-note">
      <Info size={15} aria-hidden="true"/>
      {payment === 'online'
        ? 'به درگاه پرداخت آزمایشی می‌روی؛ در هیچ مرحله‌ای اطلاعات کارت بانکی پرسیده نمی‌شود.'
        : 'مبلغ ' + toman(totals.total) + ' را هنگام تحویل با کارت‌خوان پرداخت می‌کنی.'}
    </p>
    <div className="checkout-submit-bar">
      {outcome && <p className={'status-message checkout-outcome' + (outcome === 'failed' ? ' error' : ' is-neutral')}
        role={outcome === 'failed' ? 'alert' : 'status'}>
        <AlertCircle size={18} aria-hidden="true"/>
        <span>{outcome === 'failed'
          ? 'پرداخت انجام نشد. سبد خریدت محفوظ است؛ دوباره تلاش کن یا روش پرداخت دیگری انتخاب کن.'
          : 'پرداخت را لغو کردی. سبد خریدت محفوظ است و هر وقت آماده بودی می‌توانی دوباره پرداخت کنی.'}</span>
      </p>}
      <button className="btn btn-primary btn-lg btn-block form-submit" type="submit">
        {payment === 'online' ? <>پرداخت <span className="price">{toman(totals.total)}</span></> : 'ثبت نهایی سفارش'}
      </button>
    </div>

    {gatewayMounted && <Sheet open={gatewayOpen} onClose={() => closeGateway('cancelled')} labelledBy="gateway-title"
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

/** Collapsed by default (most shoppers have no code, and an open empty field invites leaving to hunt
 * for one). Enter applies the code instead of submitting the payment form. */
function DiscountField({ applied, subtotal, onChange }: { applied: string; subtotal: number; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const result = applied ? applyDiscount(applied, subtotal) : null;

  function apply() {
    const next = applyDiscount(value, subtotal);
    if (!next.ok) { setError(next.message); input.current?.focus(); return; }
    setError('');
    setValue('');
    onChange(next.code);
  }

  if (applied && result) return <div className={'discount-applied' + (result.ok ? '' : ' is-invalid')} role="status">
    <Tag size={18} aria-hidden="true"/>
    <span>{result.ok
      ? <>کد <bdi dir="ltr">{applied}</bdi> اعمال شد: {result.label}</>
      : <>کد <bdi dir="ltr">{applied}</bdi> دیگر برای این سبد معتبر نیست. {result.message}</>}</span>
    <button type="button" className="link-button" onClick={() => {
      onChange('');
      setOpen(true);
      requestAnimationFrame(() => input.current?.focus());
    }}>حذف کد</button>
  </div>;

  return <div className="discount-box">
    <button type="button" className="discount-toggle" aria-expanded={open} aria-controls={id + '-panel'} onClick={() => setOpen(!open)}>
      <Tag size={18} aria-hidden="true"/> کد تخفیف داری؟<span className="disclosure-chevron" aria-hidden="true"/>
    </button>
    <div id={id + '-panel'} className="discount-panel" hidden={!open}>
      <label className="field-label" htmlFor={id + '-input'}>کد تخفیف</label>
      <div className="discount-row">
        <input ref={input} id={id + '-input'} className="control control-ltr" dir="ltr" value={value}
          autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done"
          aria-invalid={Boolean(error)} aria-describedby={id + (error ? '-error' : '-hint')}
          onChange={event => { setValue(event.target.value); if (error) setError(''); }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); apply(); } }}/>
        <button type="button" className="btn btn-secondary" onClick={apply}>اعمال</button>
      </div>
      {error
        ? <p className="field-error" id={id + '-error'}><AlertCircle size={16} aria-hidden="true"/>{error}</p>
        : <p className="field-hint" id={id + '-hint'}>
          کدهای آزمایشی: {discountCodes.map((entry, index) => <span key={entry.code}>{index ? '، ' : ''}<bdi dir="ltr">{entry.code}</bdi></span>)}
        </p>}
    </div>
  </div>;
}
