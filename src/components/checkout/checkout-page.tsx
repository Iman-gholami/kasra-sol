'use client';

import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Info, ShieldCheck, Sparkles } from 'lucide-react';
import { byId } from '@/data/products';
import { useShop } from '@/components/shop-provider';
import { LineDetails } from '@/components/cart/line-details';
import { formatNumber, toLatinDigits, toman } from '@/lib/format';

type Field = 'name' | 'mobile' | 'province' | 'city' | 'address' | 'postal' | 'notes';
type Fields = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;
const empty: Fields = { name: '', mobile: '', province: '', city: '', address: '', postal: '', notes: '' };
const sample: Fields = { name: 'مهمان نمایشی', mobile: '09120000000', province: 'تهران', city: 'تهران',
  address: 'خیابان نمونه، کوچه آزمایشی، پلاک ۱۰', postal: '1234567890', notes: '' };
const provinces = ['تهران', 'اصفهان', 'فارس', 'خراسان رضوی', 'البرز', 'گیلان', 'مازندران', 'آذربایجان شرقی', 'خوزستان', 'سایر استان‌ها'];
const order: Field[] = ['name', 'mobile', 'province', 'city', 'address', 'postal'];

/** Persian, Arabic or Latin digits; spaces, dashes and an Iranian +98/0098 prefix are tolerated. */
function normalizeMobile(value: string) {
  let digits = toLatinDigits(value).replace(/[\s\-()]/g, '');
  if (digits.startsWith('+98')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('0098')) digits = '0' + digits.slice(4);
  else if (/^98\d{10}$/.test(digits)) digits = '0' + digits.slice(2);
  else if (/^9\d{9}$/.test(digits)) digits = '0' + digits;
  return digits;
}
const normalizePostal = (value: string) => toLatinDigits(value).replace(/[\s-]/g, '');

function validate(field: Field, fields: Fields): string | undefined {
  const value = fields[field].trim();
  switch (field) {
    case 'name': return value.length < 3 ? 'نام و نام خانوادگی را کامل وارد کن.' : undefined;
    case 'mobile': return /^09\d{9}$/.test(normalizeMobile(value)) ? undefined : 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
    case 'province': return value ? undefined : 'استان را انتخاب کن.';
    case 'city': return value.length < 2 ? 'نام شهر را وارد کن.' : undefined;
    case 'address': return value.length < 12 ? 'نشانی را با جزئیات بیشتری بنویس (خیابان، کوچه، پلاک).' : undefined;
    case 'postal': return /^\d{10}$/.test(normalizePostal(value)) ? undefined : 'کد پستی باید ۱۰ رقم باشد.';
    default: return undefined;
  }
}

export function CheckoutPage() {
  const router = useRouter();
  const { cart, hydrated, clearCart } = useShop();
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const agreeRef = useRef<HTMLInputElement>(null);
  const lines = cart.flatMap(item => { const product = byId(item.productId); return product ? [{ item, product }] : []; });
  const subtotal = lines.reduce((sum, { item, product }) => sum + product.price * item.quantity, 0);
  const units = lines.reduce((sum, { item }) => sum + item.quantity, 0);

  function set(field: Field, value: string) {
    const next = { ...fields, [field]: value };
    setFields(next);
    // Once a field has been checked, re-validate as the shopper corrects it.
    if (touched[field]) setErrors(current => ({ ...current, [field]: validate(field, next) }));
  }
  function blur(field: Field) {
    if (!fields[field].trim() && !touched[field]) return;
    setTouched(current => ({ ...current, [field]: true }));
    setErrors(current => ({ ...current, [field]: validate(field, fields) }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    for (const field of order) { const message = validate(field, fields); if (message) next[field] = message; }
    setErrors(next);
    setTouched(Object.fromEntries(order.map(field => [field, true])));
    const invalid = order.filter(field => next[field]);
    if (invalid.length || !agreed || !lines.length) {
      setFormError(!agreed ? 'برای ادامه باید نمایشی بودن فرایند را تأیید کنی.' : !lines.length ? 'سبد خرید خالی است.' :
        formatNumber(invalid.length) + ' مورد نیاز به اصلاح دارد؛ لطفاً خطاهای مشخص‌شده را اصلاح کن.');
      requestAnimationFrame(() => {
        if (invalid.length) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        else if (!agreed) agreeRef.current?.focus();
      });
      return;
    }
    // No customer information is sent or stored. This is only a local demo confirmation.
    clearCart();
    router.push('/order-confirmation');
  }

  if (!hydrated) return <div className="checkout-skeleton" role="status" aria-label="در حال بارگذاری تسویه‌حساب">
    <span className="skeleton" aria-hidden="true"/><span className="skeleton" aria-hidden="true"/>
  </div>;
  if (!lines.length) return <div className="empty-state">
    <h2>سبد خرید خالی است</h2>
    <p>برای دیدن مراحل تسویه‌حساب نمایشی، اول یک لباس به سبد اضافه کن.</p>
    <Link className="btn btn-primary" href="/shop">بازگشت به فروشگاه <ArrowLeft size={18} aria-hidden="true"/></Link>
  </div>;

  const summary = <>
    <ul className="checkout-lines">
      {lines.map(({ item, product }) => <li key={item.productId + item.colorId + item.size}>
        <span className="checkout-line-name">{product.name}</span>
        <LineDetails item={item} product={product} showQuantity/>
        <strong className="price">{toman(item.quantity * product.price)}</strong>
      </li>)}
    </ul>
    <div className="summary-row total"><span>جمع اقلام (بدون ارسال)</span><strong className="price">{toman(subtotal)}</strong></div>
    <p>هزینه ارسال و مبلغ نهایی در این نسخه محاسبه نمی‌شود.</p>
  </>;

  return <>
    <ol className="checkout-progress" aria-label="مراحل خرید نمایشی">
      <li><Link href="/cart"><span aria-hidden="true">۱</span>سبد خرید</Link></li>
      <li data-current="true" aria-current="step"><span aria-hidden="true">۲</span>اطلاعات دریافت‌کننده</li>
      <li><span aria-hidden="true">۳</span>پایان آزمایش</li>
    </ol>
    <details className="checkout-summary-mobile">
      <summary><span>خلاصه سفارش، {formatNumber(units)} کالا</span><strong className="price">{toman(subtotal)}</strong></summary>
      <div className="checkout-summary-body">{summary}</div>
    </details>
    <div className="checkout-layout">
      <form className="checkout-card" id="checkout-form" ref={formRef} onSubmit={submit} noValidate aria-labelledby="checkout-form-title">
        <div className="checkout-card-head">
          <h2 id="checkout-form-title">مشخصات دریافت‌کننده</h2>
          <button type="button" className="btn btn-tertiary btn-sm" onClick={() => {
            setFields(sample); setErrors({}); setFormError('');
          }}><Sparkles size={16} aria-hidden="true"/> پر کردن با اطلاعات نمونه</button>
        </div>
        <p className="notice"><ShieldCheck size={18} aria-hidden="true"/>
          <span>این فرم فقط برای آزمایش رابط کاربری است. کسری بوتیک اطلاعات آن را ارسال یا ذخیره نمی‌کند؛ برای آزمایش می‌توانی از اطلاعات نمونه استفاده کنی.</span></p>
        <div className="form-grid">
          <TextField label="نام و نام خانوادگی" value={fields.name} error={errors.name} onChange={v => set('name', v)} onBlur={() => blur('name')}
            autoComplete="name" enterKeyHint="next"/>
          <TextField label="شماره موبایل" value={fields.mobile} error={errors.mobile} onChange={v => set('mobile', v)} onBlur={() => blur('mobile')}
            type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="next" dir="ltr" placeholder="0912 345 6789"
            hint="۱۱ رقم، با ۰۹ شروع می‌شود؛ ارقام فارسی هم پذیرفته می‌شوند."/>
          <SelectField label="استان" value={fields.province} error={errors.province} onChange={v => set('province', v)} onBlur={() => blur('province')}/>
          <TextField label="شهر" value={fields.city} error={errors.city} onChange={v => set('city', v)} onBlur={() => blur('city')}
            autoComplete="address-level2" enterKeyHint="next"/>
          <TextField label="نشانی دقیق" value={fields.address} error={errors.address} onChange={v => set('address', v)} onBlur={() => blur('address')}
            autoComplete="street-address" multiline wide placeholder="خیابان، کوچه، پلاک، واحد"/>
          <TextField label="کد پستی" value={fields.postal} error={errors.postal} onChange={v => set('postal', v)} onBlur={() => blur('postal')}
            inputMode="numeric" autoComplete="postal-code" enterKeyHint="done" dir="ltr" placeholder="1234567890" hint="۱۰ رقم، بدون خط تیره."/>
          <TextField label="توضیحات" optional value={fields.notes} onChange={v => set('notes', v)} multiline wide placeholder="در صورت نیاز…"/>
        </div>
        <p className="notice checkout-disclaimer"><Info size={18} aria-hidden="true"/>
          <span>شیوه و هزینه ارسال در فروشگاه واقعی مشخص خواهد شد. هیچ درگاه پرداخت یا ثبت سفارش واقعی در این نمونه وجود ندارد.</span></p>
        <div className="checkout-actions">
          <label className="check-row"><input ref={agreeRef} type="checkbox" checked={agreed}
            onChange={event => { setAgreed(event.target.checked); setFormError(''); }}/> می‌دانم این سفارش واقعی نیست.</label>
          {formError && <p className="status-message error" role="alert"><AlertCircle size={18} aria-hidden="true"/>{formError}</p>}
        </div>
        <div className="checkout-submit-bar">
          <button className="btn btn-primary btn-lg btn-block form-submit" type="submit">تأیید نمایشی سفارش</button>
        </div>
      </form>
      <aside className="summary-card checkout-summary" aria-labelledby="checkout-summary-title">
        <h2 id="checkout-summary-title">خلاصه اقلام</h2>
        {summary}
      </aside>
    </div>
  </>;
}

type TextFieldProps = {
  label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; error?: string; hint?: string;
  optional?: boolean; multiline?: boolean; wide?: boolean; placeholder?: string; dir?: 'ltr';
  type?: string; inputMode?: 'tel' | 'numeric' | 'text'; autoComplete?: string; enterKeyHint?: 'next' | 'done';
};

function FieldShell({ id, label, optional, error, hint, wide, children }: { id: string; label: string; optional?: boolean; error?: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return <div className={'field form-field' + (wide ? ' wide' : '')}>
    <label className="field-label" htmlFor={id}>{label}{optional && <span className="optional"> (اختیاری)</span>}</label>
    {children}
    {hint && !error && <p className="field-hint" id={id + '-hint'}>{hint}</p>}
    {error && <p className="field-error" id={id + '-error'}><AlertCircle size={16} aria-hidden="true"/>{error}</p>}
  </div>;
}

function TextField({ label, value, onChange, onBlur, error, hint, optional, multiline, wide, placeholder, dir, type = 'text', inputMode, autoComplete, enterKeyHint }: TextFieldProps) {
  const id = useId();
  const describedBy = error ? id + '-error' : hint ? id + '-hint' : undefined;
  const common = { id, value, placeholder, autoComplete: autoComplete ?? 'off', 'aria-invalid': Boolean(error),
    'aria-describedby': describedBy, 'aria-required': optional ? undefined : true, onBlur,
    className: 'control' + (dir ? ' control-ltr' : '') };
  return <FieldShell id={id} label={label} optional={optional} error={error} hint={hint} wide={wide}>
    {multiline
      ? <textarea {...common} onChange={event => onChange(event.target.value)} rows={3}/>
      : <input {...common} type={type} dir={dir} inputMode={inputMode} enterKeyHint={enterKeyHint} onChange={event => onChange(event.target.value)}/>}
  </FieldShell>;
}

function SelectField({ label, value, onChange, onBlur, error }: { label: string; value: string; onChange: (value: string) => void; onBlur: () => void; error?: string }) {
  const id = useId();
  return <FieldShell id={id} label={label} error={error}>
    <select id={id} className="control" value={value} onChange={event => onChange(event.target.value)} onBlur={onBlur}
      autoComplete="address-level1" aria-invalid={Boolean(error)} aria-required aria-describedby={error ? id + '-error' : undefined}>
      <option value="">انتخاب استان</option>
      {provinces.map(province => <option key={province} value={province}>{province}</option>)}
    </select>
  </FieldShell>;
}
