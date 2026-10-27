import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Heart, MessageCircleQuestion, Ruler, Truck } from 'lucide-react';
import { categories, lookbookPhotos } from '@/data/products';
import { getCatalogProducts, getHomeSlides } from '@/lib/backend-products';
import { ProductRail } from '@/components/products/product-rail';
import { ShopByColor } from '@/components/home/shop-by-color';
import { HeroSlider } from '@/components/home/hero-slider';
import { collectionPhotos } from '@/components/home/collection-circles';
import { SectionHeading } from '@/components/home/section-heading';
import { NewsletterForm } from '@/components/home/newsletter-form';
import { formatNumber } from '@/lib/format';
import { getShopByColorResults } from '@/lib/shop-by-color';
import type { Product } from '@/types/store';

// Collection cards: about 2.2 in view on phones, then up to three across the page width.
const categorySizes = '(max-width: 600px) 44vw, (max-width: 1520px) 31vw, 470px';

// The season story's two plates: side by side at about 55% and 40% of the page on phones, of half the page from 821px.
const seasonSizes = '(max-width: 820px) 55vw, 380px';

// The cover photo runs edge to edge on phones and stands as a plate of at most 600px beside the copy from 601px.
const slideSizes = '(max-width: 600px) 100vw, (max-width: 820px) 420px, 600px';
/** The cover slides: the owner's pick from the admin panel. Without one, up to five discounted products, newest first,
 * leading with different photos so consecutive slides look different; failing that, the three newest products. */
function coverSlides(picked: Product[], newest: Product[]) {
  if (picked.length) return picked;
  const discounted = newest.filter(item => item.compareAt && item.compareAt > item.price);
  const distinct = discounted.filter((item, i) => discounted.findIndex(other => other.images[0] === item.images[0]) === i);
  const slides = [...distinct, ...discounted.filter(item => !distinct.includes(item))].slice(0, 5);
  return slides.length ? slides : newest.slice(0, 3);
}

/** What a first-time buyer asks before ordering clothes online, each answered by the page that holds the store's
 * terms. Worded as information, never as guarantees: delivery and return terms are the owner's to set. */
const services = [
  { href: '/size-guide', title: 'راهنمای انتخاب سایز', text: 'اندازه‌هایت را قبل از خرید با جدول سایز مقایسه کن.', Icon: Ruler },
  { href: '/shipping-and-returns', title: 'ارسال و بازگشت', text: 'روش‌های ارسال و شرایط بازگشت کالا را پیش از خرید ببین.', Icon: Truck },
  { href: '/faq', title: 'سؤال‌های پرتکرار', text: 'پاسخ کوتاه به پرسش‌های رایج درباره‌ی سفارش و اندازه.', Icon: MessageCircleQuestion },
  { href: '/wishlist', title: 'برای بعد نگه دار', text: 'لباس‌های موردعلاقه‌ات را با قلب در علاقه‌مندی‌ها ذخیره کن.', Icon: Heart }
];

export const dynamic = 'force-dynamic';
export default async function HomePage() {
  const demoPrefetch = process.env.BACKEND_INTERNAL_URL ? undefined : true;
  // With the API enabled every section reflects published products only: archived ones disappear and new ones appear.
  const [products, picked] = await Promise.all([getCatalogProducts(), getHomeSlides()]);
  const newest = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const arrivals = newest.slice(0, 8);
  const slides = coverSlides(picked, newest).map(({ id, slug, name, images, price, compareAt }) =>
    ({ id, slug, name, image: images[0], price, compareAt }));
  // Each row shows products the rows above it have not, so the page never repeats a card. A row with nothing left is
  // left out rather than shown empty (with the API, products are whatever the owner has published and marked).
  const shown = new Set(arrivals.map(item => item.id));
  const take = (list: Product[]) => {
    const row = list.filter(item => !shown.has(item.id)).slice(0, 8);
    row.forEach(item => shown.add(item.id));
    return row;
  };
  const picks = take(newest.filter(item => item.featured));
  const offers = take(newest.filter(item => item.compareAt && item.compareAt > item.price));
  // The season story shows two coats: the two newest from the API, or two demo photographs.
  const coats = newest.filter(item => item.category === 'manto');
  const season = process.env.BACKEND_INTERNAL_URL && coats.length >= 2
    ? coats.slice(0, 2).map(item => ({ src: item.images[0], alt: item.name }))
    : [{ src: lookbookPhotos.mantoBlack, alt: 'مانتوی بلند مشکی با شلوار کرم، عکس نمایشی' }, { src: lookbookPhotos.mantoSage, alt: '' }];
  const colors = getShopByColorResults(products);
  // With the API, each collection shows its newest product's photo, so real photography appears without code changes.
  const collections = categories.map(({ slug, title }) => ({
    slug, title, count: products.filter(item => item.category === slug).length,
    photo: (process.env.BACKEND_INTERNAL_URL && newest.find(item => item.category === slug)?.images[0]) || collectionPhotos[slug]
  }));

  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-pretitle">کالکشن تازه · پاییز ۱۴۰۵</p>
        <h1 id="hero-title">استایل هر روزت، <em>به سبک خودت.</em></h1>
        <p className="hero-lede">شومیز، مانتو و تیشرت؛ ساده، خوش‌دوخت و راحت برای هر روز.</p>
        <div className="hero-actions">
          <Link href="/shop?sort=newest" prefetch={demoPrefetch} className="btn btn-primary btn-lg">مشاهده‌ی کالکشن جدید <ArrowLeft size={19} aria-hidden="true"/></Link>
        </div>
      </div>
      {slides.length > 0 && <HeroSlider slides={slides} sizes={slideSizes}/>}
    </section>

    <section className="container home-section category-section" aria-labelledby="categories-title">
      <SectionHeading id="categories-title" title="دسته‌بندی‌ها" href="/shop" linkLabel="همه‌ی محصولات"/>
      <ul className="category-row">
        {collections.map(({ slug, title, photo, count }) => <li key={slug}>
          <Link href={'/category/' + slug} prefetch={demoPrefetch} className="category-card">
            <span className="category-card-photo"><Image src={photo} alt="" fill sizes={categorySizes}/></span>
            <span className="category-card-name">{title}</span>
            <span className="category-card-count">{formatNumber(count)} مدل</span>
          </Link>
        </li>)}
      </ul>
    </section>

    <section className="container home-section" aria-labelledby="arrivals-title">
      <SectionHeading id="arrivals-title" title="تازه‌ترین‌ها" href="/shop?sort=newest" linkLabel="مشاهده‌ی همه"/>
      <ProductRail products={arrivals} label="تازه‌ترین محصولات"/>
    </section>

    <section className="home-section season" aria-labelledby="season-title">
      <div className="container editorial-band">
        <div className="season-photos">
          {season.map(({ src, alt }) => <span key={src} className="season-photo"><Image src={src} alt={alt} fill sizes={seasonSizes}/></span>)}
        </div>
        <div className="season-copy">
          <p className="season-kicker">کالکشن پاییز ۱۴۰۵</p>
          <h2 id="season-title">لایه‌های سبک برای روزهای خنک</h2>
          <p>مانتوهای خوش‌فرم و راحت، در رنگ‌هایی که با هم جور می‌شوند.</p>
          <Link href="/category/manto" prefetch={demoPrefetch} className="btn btn-secondary">مانتوها را ببین <ArrowLeft size={18} aria-hidden="true"/></Link>
        </div>
      </div>
    </section>

    {picks.length > 0 && <section className="container home-section" aria-labelledby="picks-title">
      <SectionHeading id="picks-title" title="منتخب کسری" href="/shop?sort=featured" linkLabel="مشاهده‌ی همه"/>
      <ProductRail products={picks} label="منتخب کسری"/>
    </section>}

    <section className="container home-section services" aria-labelledby="services-title">
      <h2 id="services-title" className="sr-only">خرید با خیال راحت</h2>
      <ul className="service-list">
        {services.map(({ href, title, text, Icon }) => <li key={href}>
          <Link href={href} className="service-item"><Icon size={24} strokeWidth={1.5} aria-hidden="true"/><span><strong>{title}</strong><small>{text}</small></span></Link>
        </li>)}
      </ul>
    </section>

    {offers.length > 0 && <section className="container home-section" aria-labelledby="offers-title">
      <SectionHeading id="offers-title" title="پیشنهاد ویژه" note="قیمت ویژه برای چند انتخاب از کالکشن." href="/shop?sale=1" linkLabel="همه‌ی تخفیف‌دارها"/>
      <ProductRail products={offers} label="محصولات تخفیف‌دار"/>
    </section>}

    <ShopByColor options={colors}/>

    <section className="container home-section club" aria-labelledby="club-title">
      <div className="club-copy">
        <h2 id="club-title">باشگاه مشتریان کسری</h2>
        <p>از رسیدن کالکشن‌های تازه با پیامک باخبر شو.</p>
      </div>
      <NewsletterForm/>
    </section>
  </>;
}
