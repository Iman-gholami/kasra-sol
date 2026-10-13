import type { Metadata } from 'next';
import Link from 'next/link';
import { UserRound } from 'lucide-react';
export const metadata: Metadata = { title: 'حساب کاربری نمایشی', robots: { index: false, follow: false } };
export default function Page() { return <div className="container content-page"><span className="eyebrow">MY KASRA</span><h1>حساب کاربری</h1>
  <div className="empty-state"><UserRound size={35} strokeWidth={1.3} /><h2>حساب کاربری هنوز فعال نیست</h2><p>در نسخه نمایشی نیازی به ورود نیست. احراز هویت و تاریخچه سفارش‌ها در مرحله بعد اضافه می‌شوند.</p><Link className="btn btn-dark" href="/shop">خرید بدون حساب (نمایشی)</Link></div>
</div>; }
