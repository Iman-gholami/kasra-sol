'use client';

import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { AlertCircle, ArrowLeft, Info, Plus, Sparkles } from 'lucide-react';
import { ChoiceCard, SelectField, TextField, addressOrder, sampleFields, validate } from '@/components/checkout/fields';
import type { CheckoutDraft, Field, Fields } from '@/components/checkout/checkout-storage';
import { DEFAULT_PAYMENT, DEFAULT_SHIPPING, shippingById, shippingCost, shippingMethods, shippingRestriction,
  type ShippingMethodId } from '@/lib/checkout';
import { formatNumber, toman } from '@/lib/format';

type Errors = Partial<Record<Field, string>>;

/** Step one: where it goes and how. The cheapest method is preselected; methods that cannot serve the
 * address stay visible with their reason. */
export function ShippingStep({ draft, update, subtotal, headingRef, onContinue }: {
  draft: CheckoutDraft; update: (patch: Partial<CheckoutDraft>) => void; subtotal: number;
  headingRef: RefObject<HTMLHeadingElement | null>; onContinue: () => void;
}) {
  const { fields } = draft;
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [formError, setFormError] = useState('');
  const [methodNotice, setMethodNotice] = useState('');
  const [notesOpen, setNotesOpen] = useState(Boolean(fields.notes));
  const formRef = useRef<HTMLFormElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  /** Switch away from a method the (new) address cannot use, and say so. Returns true when it switched. */
  function fitShipping(next: Fields): boolean {
    const current = shippingById(draft.shipping);
    if (!shippingRestriction(current, next.province, next.city)) return false;
    update({ fields: next, shipping: DEFAULT_SHIPPING, payment: DEFAULT_PAYMENT });
    setMethodNotice(current.title + ' فقط برای نشانی‌های داخل شهر تهران است؛ روش ارسال به '
      + shippingById(DEFAULT_SHIPPING).title + ' تغییر کرد.');
    return true;
  }

  function set(field: Field, value: string) {
    const next = { ...fields, [field]: value };
    if (!(field === 'province' && fitShipping(next))) update({ fields: next });
    // Once a field has been checked, re-validate as the shopper corrects it.
    if (touched[field]) setErrors(current => ({ ...current, [field]: validate(field, next) }));
  }
  function blur(field: Field) {
    if (field === 'city') fitShipping(fields);
    if (!fields[field].trim() && !touched[field]) return;
    setTouched(current => ({ ...current, [field]: true }));
    setErrors(current => ({ ...current, [field]: validate(field, fields) }));
  }
  function chooseShipping(id: ShippingMethodId) {
    setMethodNotice('');
    // Pay-on-delivery only exists with the courier; drop it if the courier is no longer chosen.
    update(id === 'courier' ? { shipping: id } : { shipping: id, payment: DEFAULT_PAYMENT });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    for (const field of addressOrder) { const message = validate(field, fields); if (message) next[field] = message; }
    setErrors(next);
    setTouched(Object.fromEntries(addressOrder.map(field => [field, true])));
    const invalid = addressOrder.filter(field => next[field]);
    if (invalid.length) {
      setFormError(formatNumber(invalid.length) + ' مورد نیاز به اصلاح دارد؛ لطفاً خطاهای مشخص‌شده را اصلاح کن.');
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setFormError('');
    if (fitShipping(fields)) return;
    onContinue();
  }

  return <form className="checkout-card" ref={formRef} onSubmit={submit} noValidate aria-labelledby="checkout-step-title">
    <div className="checkout-card-head">
      <h2 id="checkout-step-title" ref={headingRef} tabIndex={-1}>نشانی و روش ارسال</h2>
      <button type="button" className="btn btn-tertiary btn-sm" onClick={() => {
        update({ fields: sampleFields }); setErrors({}); setFormError(''); setMethodNotice('');
      }}><Sparkles size={16} aria-hidden="true"/> پر کردن با اطلاعات نمونه</button>
    </div>
    <p className="checkout-card-intro">{process.env.NEXT_PUBLIC_BACKEND_ENABLED === 'true'
      ? 'اطلاعات ارسال هنگام ثبت نهایی سفارش به سرور فرستاده و همراه سفارش ذخیره می‌شود.'
      : 'اطلاعاتت فقط در همین تب مرورگر نگه داشته می‌شود و به هیچ سروری ارسال نمی‌شود.'}</p>

    <h3 className="checkout-section-title">نشانی تحویل</h3>
    <div className="form-grid">
      <TextField label="نام و نام خانوادگی تحویل‌گیرنده" value={fields.name} error={errors.name} onChange={v => set('name', v)} onBlur={() => blur('name')}
        autoComplete="name" enterKeyHint="next"/>
      <TextField label="شماره موبایل" value={fields.mobile} error={errors.mobile} onChange={v => set('mobile', v)} onBlur={() => blur('mobile')}
        type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" dir="ltr" placeholder="0912 345 6789"
        hint="برای هماهنگی تحویل؛ ارقام فارسی هم پذیرفته می‌شوند."/>
      <SelectField label="استان" value={fields.province} error={errors.province} onChange={v => set('province', v)} onBlur={() => blur('province')}/>
      <TextField label="شهر" value={fields.city} error={errors.city} onChange={v => set('city', v)} onBlur={() => blur('city')}
        autoComplete="address-level2" enterKeyHint="next"/>
      <TextField label="نشانی دقیق" value={fields.address} error={errors.address} onChange={v => set('address', v)} onBlur={() => blur('address')}
        autoComplete="street-address" multiline wide placeholder="خیابان، کوچه، پلاک، واحد"/>
      <TextField label="کد پستی" value={fields.postal} error={errors.postal} onChange={v => set('postal', v)} onBlur={() => blur('postal')}
        inputMode="numeric" autoComplete="postal-code" enterKeyHint="done" dir="ltr" placeholder="1234567890" hint="۱۰ رقم، بدون خط تیره."/>
      {notesOpen
        ? <div className="form-grid-wide" ref={notesRef}>
          <TextField label="توضیح برای مأمور ارسال" optional value={fields.notes} onChange={v => set('notes', v)} multiline
            placeholder="مثلاً: زنگ واحد ۲ کار نمی‌کند"/>
        </div>
        : <button type="button" className="link-button checkout-add-note" onClick={() => {
          setNotesOpen(true);
          requestAnimationFrame(() => notesRef.current?.querySelector('textarea')?.focus());
        }}><Plus size={16} aria-hidden="true"/> افزودن توضیح برای مأمور ارسال</button>}
    </div>

    <fieldset className="choice-group" id="shipping-method">
      <legend className="checkout-section-title">روش ارسال</legend>
      {methodNotice && <p className="choice-notice" role="status"><Info size={16} aria-hidden="true"/>{methodNotice}</p>}
      {shippingMethods.map(method => {
        const reason = shippingRestriction(method, fields.province, fields.city);
        const cost = shippingCost(method, subtotal);
        return <ChoiceCard key={method.id} name="shipping" value={method.id} checked={draft.shipping === method.id}
          disabled={Boolean(reason)} title={method.title} detail={method.eta} reason={reason}
          aside={cost ? <span className="price">{toman(cost)}</span>
            : <><s className="price" aria-hidden="true">{toman(method.price)}</s> <strong>رایگان</strong></>}
          onChange={() => chooseShipping(method.id)}/>;
      })}
    </fieldset>

    {formError && <p className="status-message error checkout-form-error" role="alert"><AlertCircle size={18} aria-hidden="true"/>{formError}</p>}
    <div className="checkout-submit-bar">
      <button className="btn btn-primary btn-lg btn-block form-submit" type="submit">
        ادامه و انتخاب روش پرداخت <ArrowLeft size={18} aria-hidden="true"/>
      </button>
    </div>
  </form>;
}
