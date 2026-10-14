import Link from 'next/link';
import { categories } from '@/data/facets';

export function Footer() {
  return <footer className="footer">
    <div className="container footer-grid">
      <div className="footer-intro">
        <Link className="footer-wordmark" href="/" aria-label="کسری بوتیک، صفحه اصلی">
          <span dir="ltr" aria-hidden="true">KASRA</span><small dir="ltr" aria-hidden="true">BOUTIQUE</small>
        </Link>
        <p>انتخاب‌هایی برای استایلِ خودت؛ ساده، راحت و با حال‌وهوای هر روز.</p>
        <p className="footer-demo">این وب‌سایت نسخه نمایشی است؛ کالاها، تصاویر، قیمت‌ها و موجودی‌ها آزمایشی‌اند.</p>
      </div>
      <nav aria-labelledby="footer-collections">
        <h2 id="footer-collections">کالکشن‌ها</h2>
        <ul>
          <li><Link href="/shop">همه محصولات</Link></li>
          {categories.map(item => <li key={item.slug}><Link href={'/category/' + item.slug}>{item.title}</Link></li>)}
        </ul>
      </nav>
      <nav aria-labelledby="footer-help">
        <h2 id="footer-help">راهنمای خرید</h2>
        <ul>
          <li><Link href="/size-guide">راهنمای سایز</Link></li>
          <li><Link href="/shipping-and-returns">ارسال و بازگشت (نمونه)</Link></li>
          <li><Link href="/faq">سؤال‌های پرتکرار</Link></li>
        </ul>
      </nav>
      <nav aria-labelledby="footer-brand">
        <h2 id="footer-brand">کسری بوتیک</h2>
        <ul>
          <li><Link href="/about">درباره کسری</Link></li>
          <li><Link href="/contact">ارتباط با ما</Link></li>
          <li><Link href="/account">حساب کاربری (نمایشی)</Link></li>
        </ul>
      </nav>
    </div>
    <div className="container footer-bottom">
      <p>© کسری بوتیک · نسخه نمایشی برای ارزیابی تجربه خرید</p>
    </div>
  </footer>;
}
