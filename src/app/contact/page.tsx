import type { Metadata } from 'next';
import { pageMetadata, SITE_NAME } from '@/lib/seo';
import Link from 'next/link';
import { Info } from 'lucide-react';
export const metadata: Metadata = { title: 'ارتباط با ما', ...pageMetadata({ path: '/contact', title: 'ارتباط با ما | ' + SITE_NAME }) };
export default function Page() {
  return <article className="container content-page">
    <p className="section-kicker">ارتباط با ما</p>
    <h1>حرفی با کسری داری؟</h1>
    <p className="notice"><Info size={18} aria-hidden="true"/><span>اطلاعات تماس رسمی و راه‌های پشتیبانی هنوز ثبت نشده‌اند. ایمیل، تلفن یا شبکه اجتماعی ساختگی نمایش نمی‌دهیم.</span></p>
    <p>پس از راه‌اندازی رسمی، نشانی‌های تأییدشده پشتیبانی و ساعات پاسخ‌گویی اینجا قرار می‌گیرند. فعلاً می‌توانی <Link className="link-inline" href="/faq">سؤال‌های پرتکرار</Link> یا <Link className="link-inline" href="/size-guide">راهنمای سایز</Link> را ببینی.</p>
  </article>;
}
