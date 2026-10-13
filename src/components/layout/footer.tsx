import Link from 'next/link';
import { categories } from '@/data/products';

export function Footer() {
  return <footer className="footer">
    <div className="container footer-grid">
      <div className="footer-intro">
        <Link className="footer-wordmark" href="/" dir="ltr">KASRA<span>BOUTIQUE</span></Link>
        <p>انتخاب‌هایی برای استایلِ خودت. ساده، راحت و با حال‌وهوای هر روز.</p>
        <p className="small muted">این وب‌سایت نسخه نمایشی است؛ کالاها، تصاویر و قیمت‌ها جنبه آزمایشی دارند.</p>
      </div>
      <div><h3>کالکشن‌ها</h3><Link href="/shop">همه محصولات</Link>
        {categories.map(item => <Link key={item.slug} href={'/category/'+item.slug}>{item.title}</Link>)}</div>
      <div><h3>راهنمای خرید</h3><Link href="/size-guide">راهنمای سایز</Link>
        <Link href="/shipping-and-returns">ارسال و بازگشت (نمونه)</Link><Link href="/faq">سوالات پرتکرار</Link></div>
      <div><h3>کسری بوتیک</h3><Link href="/about">درباره ما</Link><Link href="/contact">ارتباط با ما</Link>
        <Link href="/account">حساب نمایشی</Link></div>
    </div>
    <div className="container footer-bottom"><span>© کسری بوتیک · نسخه نمایشی</span><span dir="ltr">EVERYDAY, BEAUTIFULLY STYLED</span></div>
  </footer>;
}
