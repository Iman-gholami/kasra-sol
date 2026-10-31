import type { Metadata } from 'next';
import { pageMetadata, SITE_NAME } from '@/lib/seo';
export const metadata: Metadata = { title: 'سؤال‌های پرتکرار', ...pageMetadata({ path: '/faq', title: 'سؤال‌های پرتکرار | ' + SITE_NAME }) };
const questions = [
  { q: 'آیا می‌توانم همین حالا سفارش واقعی ثبت کنم؟', a: 'خیر. این وب‌سایت فقط نسخه نمایشی است و هیچ سفارش یا پرداخت واقعی ثبت نمی‌شود.' },
  { q: 'چطور سایز مناسبم را انتخاب کنم؟', a: 'راهنمای سایز عمومی در وب‌سایت قرار دارد. پیش از فروش واقعی، اندازه‌های دقیق هر محصول باید ثبت شوند.' },
  { q: 'موجودی رنگ و سایزها دقیق است؟', a: 'خیر. موجودی‌ها داده‌های آزمایشی هستند؛ پس از اتصال به سیستم انبار باید به‌روز شوند.' },
  { q: 'هزینه و زمان ارسال چقدر است؟', a: 'شیوه ارسال و هزینه‌های آن هنوز مشخص نشده است و در نسخه فعلی صرفاً جایگاه نمایش اطلاعات ایجاد شده.' },
  { q: 'علاقه‌مندی‌ها و سبد خرید کجا ذخیره می‌شوند؟', a: 'فقط در حافظه محلی مرورگر شما، آن هم به‌عنوان داده نمایشی. با پاک‌کردن داده‌های سایت حذف می‌شوند.' }
];
export default function Page() {
  return <div className="container content-page">
    <p className="section-kicker">خوب است بدانی</p>
    <h1>سؤال‌های پرتکرار</h1>
    <h2 className="sr-only">پرسش‌ها و پاسخ‌ها</h2>
    <div className="accordion-group">
      {questions.map(({ q, a }) => <details key={q} className="accordion">
        <summary>{q}</summary>
        <div className="accordion-body"><p>{a}</p></div>
      </details>)}
    </div>
  </div>;
}
