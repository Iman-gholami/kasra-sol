import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, UserRound } from 'lucide-react';
export const metadata: Metadata = { title: 'حساب کاربری نمایشی', robots: { index: false, follow: false } };
export default function Page() {
  return <div className="container content-page">
    <p className="section-kicker">کسری من</p>
    <h1>حساب کاربری</h1>
    <div className="empty-state">
      <UserRound size={34} strokeWidth={1.3} aria-hidden="true"/>
      <h2>حساب کاربری هنوز فعال نیست</h2>
      <p>در نسخه نمایشی نیازی به ورود نیست. سبد خرید و علاقه‌مندی‌ها فقط در همین مرورگر نگه داشته می‌شوند.</p>
      <div className="empty-actions">
        <Link className="btn btn-primary" href="/shop">خرید بدون حساب (نمایشی) <ArrowLeft size={18} aria-hidden="true"/></Link>
        <Link className="btn btn-secondary" href="/wishlist">علاقه‌مندی‌ها</Link>
      </div>
    </div>
  </div>;
}
