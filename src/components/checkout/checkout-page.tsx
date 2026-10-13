'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { byId } from '@/data/products';
import { useShop } from '@/components/shop-provider';
import { toLatinDigits, toman } from '@/lib/format';

type Field = 'name' | 'mobile' | 'province' | 'city' | 'address' | 'postal' | 'notes';
type Fields = Record<Field, string>;
const empty: Fields = { name: '', mobile: '', province: '', city: '', address: '', postal: '', notes: '' };
const provinces = ['تهران', 'اصفهان', 'فارس', 'خراسان رضوی', 'البرز', 'گیلان', 'مازندران', 'آذربایجان شرقی', 'خوزستان', 'سایر استان‌ها'];

export function CheckoutPage() {
  const router = useRouter();
  const { cart, hydrated, clearCart } = useShop();
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [agreed, setAgreed] = useState(false);
  const [formError, setFormError] = useState('');
  const lines = cart.flatMap((item) => { const p = byId(item.productId); return p ? [{ item, product: p }] : []; });
  const subtotal = lines.reduce((sum, {item, product}) => sum + product.price * item.quantity, 0);
  const set = (field: Field, value: string) => { setFields((current) => ({...current, [field]: value})); setErrors((e) => ({...e, [field]: undefined})); };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Partial<Record<Field, string>> = {};
    if (fields.name.trim().length < 3) next.name = 'نام و نام خانوادگی را کامل وارد کن.';
    if (!/^09\d{9}$/.test(toLatinDigits(fields.mobile.trim()))) next.mobile = 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
    if (!fields.province) next.province = 'استان را انتخاب کن.';
    if (fields.city.trim().length < 2) next.city = 'نام شهر را وارد کن.';
    if (fields.address.trim().length < 12) next.address = 'نشانی را با جزئیات بیشتری بنویس.';
    if (!/^\d{10}$/.test(toLatinDigits(fields.postal.trim()))) next.postal = 'کد پستی باید ۱۰ رقم باشد.';
    setErrors(next);
    if (Object.keys(next).length || !agreed || !lines.length) {
      setFormError(!agreed ? 'برای ادامه باید نمایشی بودن فرایند را تأیید کنی.' : !lines.length ? 'سبد خرید خالی است.' : 'لطفاً خطاهای مشخص‌شده را اصلاح کن.');
      return;
    }
    // No customer information is sent or stored. This is only a local demo confirmation.
    clearCart();
    router.push('/order-confirmation');
  }

  if (!hydrated) return <div className="container loading-skeleton" role="status" aria-label="بارگذاری تسویه‌حساب" />;
  if (!lines.length) return <div className="container"><h1 className="page-heading">تسویه‌حساب نمایشی</h1><div className="empty-state"><h2>سبد خرید خالی است</h2><p>برای ادامه ابتدا محصولی به سبد اضافه کن.</p><Link className="btn btn-dark" href="/shop">بازگشت به فروشگاه</Link></div></div>;

  return <div className="container"><h1 className="page-heading">تسویه‌حساب <span className="muted small">(فقط نمایش)</span></h1>
    <div className="checkout-layout">
      <form className="checkout-card" onSubmit={submit} noValidate>
        <h2>مشخصات دریافت‌کننده</h2><div className="demo-alert">این فرم فقط برای آزمایش رابط کاربری است. هیچ اطلاعاتی ذخیره یا ارسال نمی‌شود؛ لطفاً از اطلاعات واقعی حساس استفاده نکن.</div>
        <div className="form-grid">
          <label className="form-field">نام و نام خانوادگی <input autoComplete="off" value={fields.name} onChange={(e) => set('name', e.target.value)} aria-invalid={Boolean(errors.name)} />{errors.name && <small role="alert">{errors.name}</small>}</label>
          <label className="form-field">شماره موبایل <input type="tel" dir="ltr" inputMode="tel" placeholder="09123456789" autoComplete="off" value={fields.mobile} onChange={(e) => set('mobile', e.target.value)} aria-invalid={Boolean(errors.mobile)} />{errors.mobile && <small role="alert">{errors.mobile}</small>}</label>
          <label className="form-field">استان<select value={fields.province} onChange={(e) => set('province', e.target.value)} aria-invalid={Boolean(errors.province)}><option value="">انتخاب استان</option>{provinces.map((province) => <option key={province} value={province}>{province}</option>)}</select>{errors.province && <small role="alert">{errors.province}</small>}</label>
          <label className="form-field">شهر<input autoComplete="off" value={fields.city} onChange={(e) => set('city', e.target.value)} aria-invalid={Boolean(errors.city)} />{errors.city && <small role="alert">{errors.city}</small>}</label>
          <label className="form-field wide">نشانی دقیق<textarea autoComplete="off" value={fields.address} onChange={(e) => set('address', e.target.value)} aria-invalid={Boolean(errors.address)} placeholder="خیابان، کوچه، پلاک، واحد" />{errors.address && <small role="alert">{errors.address}</small>}</label>
          <label className="form-field">کد پستی<input dir="ltr" inputMode="numeric" autoComplete="off" value={fields.postal} onChange={(e) => set('postal', e.target.value)} aria-invalid={Boolean(errors.postal)} />{errors.postal && <small role="alert">{errors.postal}</small>}</label>
          <label className="form-field wide">توضیحات اختیاری<textarea value={fields.notes} onChange={(e) => set('notes', e.target.value)} placeholder="در صورت نیاز..." /></label>
        </div>
        <div className="checkout-disclaimer">شیوه و هزینه ارسال در فروشگاه واقعی مشخص خواهد شد. هیچ درگاه پرداخت یا ثبت سفارش واقعی در این نمونه وجود ندارد.</div>
        <label className="check-row" style={{display:'flex',gap:12,alignItems:'center',fontSize:'.86rem'}}><input type="checkbox" checked={agreed} onChange={(e) => {setAgreed(e.target.checked);setFormError('');}} /> می‌دانم این سفارش واقعی نیست.</label>
        {formError && <p className="status-message error" role="alert">{formError}</p>}
        <button className="btn btn-dark form-submit" type="submit">تأیید نمایشی سفارش</button>
      </form>
      <aside className="summary-card"><h2>خلاصه اقلام</h2>{lines.map(({ item, product }) =>
        <div key={item.productId + item.colorId + item.size} className="summary-row"><span>{product.name} · {item.size} × {item.quantity.toLocaleString('fa-IR')}</span><strong>{toman(item.quantity * product.price)}</strong></div>)}
        <div className="summary-row total"><span>جمع اقلام (بدون ارسال)</span><strong>{toman(subtotal)}</strong></div><p>هزینه نهایی قابل پرداخت در این نسخه محاسبه نمی‌شود.</p>
      </aside>
    </div>
  </div>;
}
