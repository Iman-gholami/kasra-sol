import type { Metadata } from 'next';
import { pageMetadata, SITE_NAME } from '@/lib/seo';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
export const metadata: Metadata = { title: 'درباره کسری بوتیک', ...pageMetadata({ path: '/about', title: 'درباره کسری بوتیک | ' + SITE_NAME }) };
export default function Page() {
  return <article className="container content-page">
    <p className="section-kicker">درباره کسری</p>
    <h1>لباس‌هایی به سبک زندگی امروز</h1>
    <p className="content-lede">کسری بوتیک در این نمونه، تصویری از یک بوتیک زنانه مینیمال است؛ جایی برای کشف شومیز، مانتو و تیشرت‌هایی که با سلیقه شخصی تو هماهنگ‌اند.</p>
    <p>این متن معرفی موقت است و پیش از انتشار رسمی باید با داستان واقعی برند، تیم و خدمات جایگزین شود. محصولات و قیمت‌های فعلی نیز داده‌های ساختگی برای ارزیابی تجربه کاربری هستند.</p>
    <Link className="btn btn-primary" href="/shop">دیدن کالکشن‌ها <ArrowLeft size={18} aria-hidden="true"/></Link>
  </article>;
}
