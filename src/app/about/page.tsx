import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { title: 'درباره کسری بوتیک' };
export default function Page() { return <article className="container content-page"><span className="eyebrow">ABOUT KASRA</span><h1>لباس‌هایی به سبک زندگی امروز</h1>
  <p>کسری بوتیک در این نمونه، تصویری از یک بوتیک زنانه مینیمال است؛ جایی برای کشف شومیز، مانتو و تیشرت‌هایی که با سلیقه شخصی تو هماهنگ‌اند.</p>
  <p>این متن معرفی موقت است و پیش از انتشار رسمی باید با داستان واقعی برند، تیم و خدمات جایگزین شود. محصولات و قیمت‌های فعلی نیز داده‌های ساختگی برای ارزیابی تجربه کاربری هستند.</p>
  <Link className="btn btn-dark" href="/shop">دیدن کالکشن‌ها</Link>
</article>; }
