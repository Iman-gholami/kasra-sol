import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft } from 'lucide-react';
import { studioPhotos } from '@/data/products';
import { getCatalogProducts, getHomeSlides } from '@/lib/backend-products';
import { ProductGrid } from '@/components/products/product-grid';
import { ShopByColor } from '@/components/home/shop-by-color';
import { HeroSlider } from '@/components/home/hero-slider';
import { CollectionCircles } from '@/components/home/collection-circles';
import { WeekLooks } from '@/components/home/week-looks';
import { getShopByColorResults } from '@/lib/shop-by-color';
import { HOME_SHARE, pageMetadata } from '@/lib/seo';
import type { Product } from '@/types/store';

// The cover figure takes about three quarters of the studio room on phones and a third of the page on wide screens.
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

export const metadata = pageMetadata({ path: '/', ...HOME_SHARE });
export const dynamic = 'force-dynamic';
export default async function HomePage() {
  const demoPrefetch = process.env.BACKEND_INTERNAL_URL ? undefined : true;
  // With the API enabled every section reflects published products only: archived ones disappear and new ones appear.
  const [products, picked] = await Promise.all([getCatalogProducts(), getHomeSlides()]);
  const newest = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const arrivals = newest.slice(0, 4);
  // In demo mode the cover is one still slide: the first discounted shirt, shown in the studio cover portrait.
  // When backend images exist, the owner's picks and normal hero rotation are unchanged.
  const firstDemoHero = products.find(item => item.slug === 'shomiz-01') ?? coverSlides(picked, newest)[0];
  const heroProducts = process.env.BACKEND_INTERNAL_URL
    ? coverSlides(picked, newest)
    : firstDemoHero ? [firstDemoHero] : [];
  const slides = heroProducts.map(({ id, slug, name, images, price, compareAt }) =>
    ({ id, slug, name, image: process.env.BACKEND_INTERNAL_URL ? images[0] : studioPhotos.cover, price, compareAt }));
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

    <WeekLooks/>

    <section className="container section-block" aria-labelledby="arrivals-title">
      <div className="section-heading">
        <h2 id="arrivals-title">تازه رسیده‌ها</h2>
        <Link className="text-link" href="/shop?sort=newest">مشاهده همه <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>
      <ProductGrid products={arrivals}/>
    </section>

    <ShopByColor options={colors}/>

    <nav className="container service-links" aria-label="راهنمای خرید از کسری">
      <Link href="/size-guide"><span><strong>راهنمای انتخاب سایز</strong><small>اندازه‌گیری درست، قبل از انتخاب</small></span><ArrowUpLeft size={20} aria-hidden="true"/></Link>
      <Link href="/shipping-and-returns"><span><strong>ارسال و بازگشت</strong><small>اطلاعات نمونه، هنوز نهایی نشده</small></span><ArrowUpLeft size={20} aria-hidden="true"/></Link>
      <Link href="/faq"><span><strong>سؤال‌های پرتکرار</strong><small>پاسخ کوتاه به پرسش‌های رایج</small></span><ArrowUpLeft size={20} aria-hidden="true"/></Link>
    </nav>

    <section className="container wide-editorial closing" aria-labelledby="closing-title">
      <span className="closing-figure"><Image src={studioPhotos.closing} alt="" fill sizes="(max-width: 600px) 48vw, 360px"/></span>
      <div className="closing-copy">
        <h2 id="closing-title">یک انتخاب برای امروز، یک استایل به سبک تو.</h2>
        <p>لباس‌های موردعلاقه‌ات رو پیدا کن و با علامت قلب برای بعد نگه دار.</p>
      </div>
      <Link href="/shop" className="btn btn-primary">دیدن همه لباس‌ها <ArrowLeft size={18} aria-hidden="true"/></Link>
    </section>
  </>;
}
