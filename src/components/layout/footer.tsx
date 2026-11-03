import Link from 'next/link';
import { categories } from '@/data/facets';
import { EnamadSeal, enamadEnabled } from '@/components/layout/enamad-seal';
import { KasraWordmark } from '@/components/layout/kasra-wordmark';
import { PhoneLines, SocialLinks } from '@/components/layout/contact-channels';

/** One charcoal panel, read like the boutique's calling card: the wordmark, the three phone lines set large in the
 * logo's cream (one tap calls), the social pages, the site's links, then the small print with the trust seal. */
export function Footer() {
  return <footer className="footer">
    <div className="container footer-panel">
      <div className="footer-intro">
        <Link className="footer-wordmark" href="/">
          <KasraWordmark/>
          <span className="sr-only">کسری بوتیک، صفحه اصلی</span>
        </Link>
        <p>انتخاب‌هایی برای استایلِ خودت؛ ساده، راحت و با حال‌وهوای هر روز.</p>
      </div>

      <section className="footer-contact" aria-labelledby="footer-contact">
        <h2 id="footer-contact">تماس با کسری</h2>
        <PhoneLines/>
        <SocialLinks/>
      </section>

      <div className="footer-links">
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
        <nav className="footer-brand" aria-label="کسری بوتیک">
          <ul>
            <li><Link href="/about">درباره کسری</Link></li>
            <li><Link href="/contact">ارتباط با ما</Link></li>
            <li><Link href="/account">حساب کاربری (نمایشی)</Link></li>
          </ul>
        </nav>
      </div>

      <div className="footer-bottom">
        <div className="footer-fineprint">
          <p>© کسری بوتیک · نسخه نمایشی برای ارزیابی تجربه خرید</p>
          <p>این وب‌سایت نسخه نمایشی است؛ کالاها، تصاویر، قیمت‌ها و موجودی‌ها آزمایشی‌اند.</p>
        </div>
        {enamadEnabled() && <EnamadSeal/>}
      </div>
    </div>
  </footer>;
}
