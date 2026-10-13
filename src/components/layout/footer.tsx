import Link from 'next/link';
import { categories } from '@/data/products';

export function Footer() {
  return <footer className="footer">
    <div className="container footer-grid">
      <div><div className="footer-brand">کسری <span>بوتیک</span></div>
        <p>لباس‌هایی برای روزهای تو؛ ساده، راحت و با حال‌وهوای امروز.</p>
        <p className="small muted">این فروشگاه صرفاً یک نمونه نمایشی است و اطلاعات تجاری آن هنوز تأیید نشده‌اند.</p>
      </div>
      <div><h3>خرید</h3><Link href="/shop">همه محصولات</Link>{categories.map((item) =>
        <Link key={item.slug} href={'/category/' + item.slug}>{item.title}</Link>)}</div>
      <div><h3>راهنمای خرید</h3><Link href="/size-guide">راهنمای سایز</Link><Link href="/shipping-and-returns">ارسال و بازگشت (نمونه)</Link><Link href="/faq">سوالات پرتکرار</Link></div>
      <div><h3>کسری بوتیک</h3><Link href="/about">درباره ما</Link><Link href="/contact">ارتباط با ما</Link><Link href="/account">حساب نمایشی</Link></div>
    </div>
    <div className="container footer-bottom"><span>© کسری بوتیک — نمونه رابط کاربری</span><span dir="ltr">Made with care · KASRA</span></div>
  </footer>;
}
