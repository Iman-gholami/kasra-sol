import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { title: 'ارتباط با ما' };
export default function Page() { return <article className="container content-page"><span className="eyebrow">GET IN TOUCH</span><h1>حرفی با کسری داری؟</h1>
  <div className="demo-alert">اطلاعات تماس رسمی و راه‌های پشتیبانی هنوز ثبت نشده‌اند. ایمیل، تلفن یا شبکه اجتماعی ساختگی نمایش نمی‌دهیم.</div>
  <p>پس از راه‌اندازی رسمی، نشانی‌های تأییدشده پشتیبانی و ساعات پاسخ‌گویی اینجا قرار می‌گیرند. برای حالا می‌توانی <Link className="subtle-link" href="/faq">سوالات پرتکرار</Link> یا <Link className="subtle-link" href="/size-guide">راهنمای سایز</Link> را ببینی.</p>
</article>; }
