import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft, Info } from 'lucide-react';
import { categories, brandMockupPhotos } from '@/data/products';
import { getCatalogProducts, getHomeSlides } from '@/lib/backend-products';
import { ProductGrid } from '@/components/products/product-grid';
import { ShopByColor } from '@/components/home/shop-by-color';
import { HeroSlider } from '@/components/home/hero-slider';
import { CollectionCircles, collectionPhotos } from '@/components/home/collection-circles';
import { getShopByColorResults } from '@/lib/shop-by-color';
import type { Product } from '@/types/store';

// Each room's figure takes about 60% of its panel (three panels side by side from 1081px, stacked below).
const roomFigureSizes = '(max-width: 600px) 52vw, (max-width: 1080px) 40vw, (max-width: 1520px) 19vw, 290px';

// The cover figure takes about three quarters of the sand room on phones and a third of the page on wide screens.
const slideSizes = '(max-width: 820px) 76vw, (max-width: 1520px) 34vw, 520px';
/** The cover slides: the owner's pick from the admin panel. Without one, up to five discounted products, newest first,
 * leading with different photos so consecutive slides look different; failing that, the three newest products. */
function coverSlides(picked: Product[], newest: Product[]) {
  if (picked.length) return picked;
  const discounted = newest.filter(item => item.compareAt && item.compareAt > item.price);
  const distinct = discounted.filter((item, i) => discounted.findIndex(other => other.images[0] === item.images[0]) === i);
  const slides = [...distinct, ...discounted.filter(item => !distinct.includes(item))].slice(0, 5);
  return slides.length ? slides : newest.slice(0, 3);
}

export const dynamic = 'force-dynamic';
export default async function HomePage() {
  const demoPrefetch = process.env.BACKEND_INTERNAL_URL ? undefined : true;
  // With the API enabled every section reflects published products only: archived ones disappear and new ones appear.
  const [products, picked] = await Promise.all([getCatalogProducts(), getHomeSlides()]);
  const newest = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const arrivals = newest.slice(0, 4);
  // The approved mockup depicts one cream-shirt studio campaign. In demo mode,
  // keep that actual reference portrait in the hero, not a 94px category crop.
  // When backend images exist, the owner's picks and normal hero rotation are unchanged.
  const firstDemoHero = products.find(item => item.slug === 'shomiz-01') ?? coverSlides(picked, newest)[0];
  const heroProducts = process.env.BACKEND_INTERNAL_URL
    ? coverSlides(picked, newest)
    : firstDemoHero ? [firstDemoHero] : [];
  const slides = heroProducts.map(({ id, slug, name, images, price, compareAt }) =>
    ({ id, slug, name, image: process.env.BACKEND_INTERNAL_URL ? images[0] : brandMockupPhotos.hero, price, compareAt }));
  const picks = ['manto-03', 'shomiz-06', 'tshirt-02', 'manto-08'].map(slug => products.find(p => p.slug === slug)!).filter(Boolean);
  const colors = getShopByColorResults(products);

  return <>
    <section className="hero container wide-editorial" aria-labelledby="hero-title">
      <div className="hero-room" aria-hidden="true"/>
      <p className="hero-pretitle"><span className="overline-rule" aria-hidden="true"/>انتخاب‌های تازه، هر روز</p>
      <h1 id="hero-title"><span className="hero-line"><span>استایل هر روزت،</span></span> <em className="hero-line"><span>به سبک خودت.</span></em></h1>
      <p className="hero-lede">از یک شومیز دوست‌داشتنی تا مانتویی که هر روز سراغش می‌ری؛ انتخاب‌های ساده برای سلیقه تو.</p>
      <div className="hero-actions">
        <Link href="/shop" prefetch={demoPrefetch} className="btn btn-primary btn-lg">کالکشن رو ببین <ArrowLeft size={19} aria-hidden="true"/></Link>
        <Link href="/shop?sort=newest" className="text-link">تازه‌ترین‌ها</Link>
      </div>
      {slides.length > 0 && <HeroSlider slides={slides} sizes={slideSizes}/>}
      <nav className="hero-collections" aria-label="میان‌بُر دسته‌بندی‌ها"><CollectionCircles/></nav>
    </section>

    <section className="container section-block category-section" aria-labelledby="categories-title">
      <div className="section-heading">
        <div><p className="section-kicker">از کجا شروع کنیم؟</p><h2 id="categories-title">کالکشن‌ها رو کشف کن</h2></div>
        <p>هر روز، یک سبک تازه از خودت.</p>
      </div>
      <ul className="category-grid">
        {categories.map(category => <li key={category.slug}>
          <Link href={'/category/' + category.slug} prefetch={demoPrefetch} className="category-tile">
            <span className="category-figure"><Image src={collectionPhotos[category.slug]} alt="" fill sizes={roomFigureSizes}/></span>
            <span className="category-description"><span className="category-name">{category.title}</span><span>{category.description}</span></span>
            <span className="arrow-disc" aria-hidden="true"><ArrowUpLeft size={20}/></span>
          </Link>
        </li>)}
      </ul>
      <p className="demo-photo-note"><Info size={15} aria-hidden="true"/> این تصاویر عین مدل‌های ماکاپ تأییدشده هستند و عکس محصولات واقعی فروشگاه نیستند.</p>
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
        <Image src={brandMockupPhotos.hero} alt="مدل نمایشی با شومیز روشن در استودیوی کسرا" fill sizes="(max-width: 600px) 86vw, 460px"/>
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
      <span className="newsletter-figure"><Image src={brandMockupPhotos.hero} alt="" fill sizes="(max-width: 600px) 46vw, 300px"/></span>
      <div className="newsletter-copy"><h2 id="closing-title">یک انتخاب برای امروز، یک استایل به سبک تو.</h2><p>لباس‌های موردعلاقه‌ات را پیدا کن و با علامت قلب برای بعد نگه دار.</p></div>
      <Link href="/shop" className="btn btn-primary">دیدن همه لباس‌ها <ArrowLeft size={18} aria-hidden="true"/></Link>
    </section>
  </>;
}
