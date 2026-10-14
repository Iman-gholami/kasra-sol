import type { Metadata } from 'next';
import { Info } from 'lucide-react';
export const metadata: Metadata = { title: 'ارسال و بازگشت — اطلاعات نمونه' };
export default function Page() {
  return <article className="container content-page">
    <p className="section-kicker">ارسال و بازگشت</p>
    <h1>ارسال و بازگشت کالا</h1>
    <p className="notice"><Info size={18} aria-hidden="true"/><span>اطلاعات این صفحه موقت و صرفاً برای نمایش ساختار صفحه‌اند؛ هیچ تعهد تجاری یا سیاست نهایی محسوب نمی‌شوند.</span></p>
    <h2>ارسال</h2><p>روش‌های ارسال، شهرهای تحت پوشش، هزینه نهایی و مدت تحویل باید پس از قرارداد با ارائه‌دهندگان حمل‌ونقل ثبت و اعلام شوند.</p>
    <h2>بازگشت کالا</h2><p>مهلت، شرایط سلامت کالا، هزینه بازگشت و فرایند بررسی پس از تدوین سیاست رسمی فروشگاه در این بخش منتشر خواهند شد.</p>
    <h2>پشتیبانی سفارش</h2><p>شماره پیگیری و ارتباط با پشتیبانی تنها بعد از راه‌اندازی سرویس ثبت سفارش قابل ارائه خواهند بود.</p>
  </article>;
}
