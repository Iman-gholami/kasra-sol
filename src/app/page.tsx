import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft, Info } from 'lucide-react';
import { categories } from '@/data/products';
import { getCatalogProducts } from '@/lib/backend-products';
import { ProductGrid } from '@/components/products/product-grid';
import { Price } from '@/components/products/price';
import { ShopByColor } from '@/components/home/shop-by-color';
import { getShopByColorResults } from '@/lib/shop-by-color';
import { editorialNumber } from '@/lib/format';
import type { Product } from '@/types/store';

const categoryPhotos = [
  '/images/lookbook/shomiz-rose.avif',
  '/images/lookbook/manto-sage.avif',
  '/images/lookbook/tshirt-blue.avif'
];
// Each room's figure takes about 60% of its panel (three panels side by side from 1081px, stacked below).
const roomFigureSizes = '(max-width: 600px) 52vw, (max-width: 1080px) 40vw, (max-width: 1520px) 19vw, 290px';

// Hero plates: the main one is the page's LCP image (preloaded, high priority); the smaller second plate is fetched
// at low priority so it never competes with it (its wipe starts 380ms later anyway).
const plateSizes = [
  '(max-width: 820px) 66vw, (max-width: 1520px) 31vw, 470px',
  '(max-width: 820px) 44vw, (max-width: 1520px) 19vw, 290px'
];
/** The cover looks: the newest product, then the newest one from another collection with a different photo. */
function coverLooks(newest: Product[]) {
  const [first] = newest;
  if (!first) return [];
  const second = newest.find(item => item.category !== first.category && item.images[0] !== first.images[0]);
  return second ? [first, second] : [first];
}

export const dynamic = 'force-dynamic';
export default async function HomePage() {
  // With the API enabled every section reflects published products only: archived ones disappear and new ones appear.
  const products = await getCatalogProducts();
  const newest = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const arrivals = newest.slice(0, 4);
  const looks = coverLooks(newest);
  const picks = ['manto-03', 'shomiz-06', 'tshirt-02', 'manto-08'].map(slug => products.find(p => p.slug === slug)!).filter(Boolean);
  const colors = getShopByColorResults(products);

  return <>
    <section className="hero container wide-editorial" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-pretitle"><span className="overline-rule" aria-hidden="true"/>انتخاب‌های تازه، هر روز</p>
        <h1 id="hero-title"><span className="hero-line"><span>استایل هر روزت،</span></span> <em className="hero-line"><span>به سبک خودت.</span></em></h1>
        <p className="hero-lede">از یک شومیز دوست‌داشتنی تا مانتویی که هر روز سراغش می‌ری؛ انتخاب‌های ساده برای سلیقه تو.</p>
        <div className="hero-actions">
          <Link href="/shop" className="btn btn-primary btn-lg">کالکشن رو ببین <ArrowLeft size={19} aria-hidden="true"/></Link>
          <Link href="/shop?sort=newest" className="text-link">تازه‌ترین‌ها</Link>
        </div>
      </div>
      {looks.length > 0 && <div className="hero-plates">
        {looks.map((look, i) => <figure key={look.id} className={'hero-plate ' + (i === 0 ? 'hero-plate-main' : 'hero-plate-second')}>
          {/* Like product cards: the photo repeats the name link, so it stays out of the tab order and the accessibility tree. */}
          <Link href={'/product/' + look.slug} className={'hero-plate-photo' + (i === 0 ? ' hero-visual' : '')} tabIndex={-1} aria-hidden="true">
            <span className="hero-plate-wipe"><span className="hero-plate-counter">
              <Image src={look.images[0]} alt="" fill sizes={plateSizes[i]} preload={i === 0} fetchPriority={i === 0 ? 'high' : 'low'}/>
            </span></span>
          </Link>
          <figcaption>
            <span className="hero-plate-no" aria-hidden="true">{editorialNumber(i + 1)}</span>
            <Link href={'/product/' + look.slug} className="hero-plate-name">{look.name}</Link>
            <Price price={look.price} compareAt={look.compareAt}/>
          </figcaption>
        </figure>)}
      </div>}
      <nav className="hero-category-links" aria-label="میان‌بُر دسته‌بندی‌ها">
        {categories.map((item, i) => <Link key={item.slug} href={'/category/' + item.slug}>
          <span className="hero-index-no" aria-hidden="true">{editorialNumber(i + 1)}</span>
          <span className="hero-index-name">{item.title}</span>
          <span className="arrow-disc" aria-hidden="true"><ArrowUpLeft size={20}/></span>
        </Link>)}
      </nav>
    </section>

    <section className="container section-block category-section" aria-labelledby="categories-title">
      <div className="section-heading">
        <div><p className="section-kicker">از کجا شروع کنیم؟</p><h2 id="categories-title">کالکشن‌ها رو کشف کن</h2></div>
        <p>هر روز، یک سبک تازه از خودت.</p>
      </div>
      <ul className="category-grid">
        {categories.map((category, i) => <li key={category.slug}>
          <Link href={'/category/' + category.slug} className="category-tile">
            <span className="category-figure"><Image src={categoryPhotos[i]} alt="" fill sizes={roomFigureSizes}/></span>
            <span className="category-description"><span className="category-name">{category.title}</span><span>{category.description}</span></span>
            <span className="arrow-disc" aria-hidden="true"><ArrowUpLeft size={20}/></span>
          </Link>
        </li>)}
      </ul>
      <p className="demo-photo-note"><Info size={15} aria-hidden="true"/> تصاویر این نسخه با هوش مصنوعی ساخته شده‌اند و برای نمایش حال‌وهوای فروشگاه هستند.</p>
    </section>

    <ShopByColor options={colors}/>

    <section className="container section-block" aria-labelledby="arrivals-title">
      <div className="section-heading">
        <div><p className="section-kicker">انتخاب تازه</p><h2 id="arrivals-title">تازه رسیده‌ها</h2></div>
        <Link className="text-link" href="/shop?sort=newest">مشاهده همه <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>
      <ProductGrid products={arrivals}/>
    </section>

    <section className="container wide-editorial editorial-band" aria-labelledby="edit-title">
      <div className="editorial-art">
        <Image src="/images/lookbook/manto-black.avif" alt="عکس نمایشی مانتوی مشکی بر تن مدل" fill sizes="(max-width: 600px) 86vw, 460px"/>
      </div>
      <div className="editorial-copy">
        <p className="editorial-super" dir="ltr">THE KASRA EDIT</p>
        <h2 id="edit-title">انتخاب‌هایی برای <em>استایلِ خودت</em></h2>
        <p>ترکیب‌های بی‌دردسر و رنگ‌هایی که همیشه می‌شه دوست‌شون داشت.</p>
        <Link href="/category/manto" className="btn btn-secondary">مانتوهای کسری <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>
    </section>

    <section className="container section-block" aria-labelledby="picks-title">
      <div className="section-heading">
        <div><p className="section-kicker">از میان کالکشن‌ها</p><h2 id="picks-title">منتخب کسری</h2></div>
        <Link className="text-link" href="/shop?sort=featured">همه پیشنهادها <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>
      <ProductGrid products={picks}/>
    </section>

    <nav className="container service-links" aria-label="راهنمای خرید از کسری">
      <Link href="/size-guide"><span><strong>راهنمای انتخاب سایز</strong><small>اندازه‌گیری درست، قبل از انتخاب</small></span><span className="arrow-disc" aria-hidden="true"><ArrowUpLeft size={20}/></span></Link>
      <Link href="/shipping-and-returns"><span><strong>ارسال و بازگشت</strong><small>اطلاعات نمونه، هنوز نهایی نشده</small></span><span className="arrow-disc" aria-hidden="true"><ArrowUpLeft size={20}/></span></Link>
      <Link href="/faq"><span><strong>سؤال‌های پرتکرار</strong><small>پاسخ کوتاه به پرسش‌های رایج</small></span><span className="arrow-disc" aria-hidden="true"><ArrowUpLeft size={20}/></span></Link>
    </nav>

    <section className="container newsletter" aria-labelledby="closing-title">
      <span className="newsletter-figure"><Image src="/images/lookbook/tshirt-white.avif" alt="" fill sizes="(max-width: 600px) 46vw, 300px"/></span>
      <div className="newsletter-copy"><h2 id="closing-title">یک انتخاب برای امروز، یک استایل به سبک تو.</h2><p>لباس‌های موردعلاقه‌ات را پیدا کن و با علامت قلب برای بعد نگه دار.</p></div>
      <Link href="/shop" className="btn btn-primary">دیدن همه لباس‌ها <ArrowLeft size={18} aria-hidden="true"/></Link>
    </section>
  </>;
}
