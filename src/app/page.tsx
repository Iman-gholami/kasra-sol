import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft } from 'lucide-react';
import { categories, lookbookPhotos } from '@/data/products';
import { getCatalogProducts, getHomeSlides } from '@/lib/backend-products';
import { ProductRail } from '@/components/products/product-rail';
import { ShopByColor } from '@/components/home/shop-by-color';
import { HeroSlider } from '@/components/home/hero-slider';
import { collectionPhotos } from '@/components/home/collection-circles';
import { SectionHeading } from '@/components/home/section-heading';
import { formatNumber } from '@/lib/format';
import { getShopByColorResults } from '@/lib/shop-by-color';
import type { Product } from '@/types/store';

// Collection cards: about 2.2 in view on phones, then up to three across the page width.
const categorySizes = '(max-width: 600px) 44vw, (max-width: 1520px) 31vw, 470px';

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

export const dynamic = 'force-dynamic';
export default async function HomePage() {
  const demoPrefetch = process.env.BACKEND_INTERNAL_URL ? undefined : true;
  // With the API enabled every section reflects published products only: archived ones disappear and new ones appear.
  const [products, picked] = await Promise.all([getCatalogProducts(), getHomeSlides()]);
  const newest = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const arrivals = newest.slice(0, 8);
  const slides = coverSlides(picked, newest).map(({ id, slug, name, images, price, compareAt }) =>
    ({ id, slug, name, image: images[0], price, compareAt }));
  const picks = ['manto-03', 'shomiz-06', 'tshirt-02', 'manto-08'].map(slug => products.find(p => p.slug === slug)!).filter(Boolean);
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

    <ShopByColor options={colors}/>

    <section className="container home-section" aria-labelledby="arrivals-title">
      <SectionHeading id="arrivals-title" title="تازه‌ترین‌ها" href="/shop?sort=newest" linkLabel="مشاهده‌ی همه"/>
      <ProductRail products={arrivals} label="تازه‌ترین محصولات"/>
    </section>

    <section className="container wide-editorial editorial-band" aria-labelledby="edit-title">
      <div className="editorial-art">
        <Image src={lookbookPhotos.mantoBlack} alt="عکس نمایشی مانتوی مشکی بر تن مدل" fill sizes="(max-width: 600px) 86vw, 460px"/>
      </div>
      <div className="editorial-copy">
        <p className="editorial-super" dir="ltr">THE KASRA EDIT</p>
        <h2 id="edit-title">انتخاب‌هایی برای <em>استایلِ خودت</em></h2>
        <p>ترکیب‌های بی‌دردسر و رنگ‌هایی که همیشه می‌شه دوست‌شون داشت.</p>
        <Link href="/category/manto" className="btn btn-secondary">مانتوهای کسری <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>
    </section>

    <section className="container home-section" aria-labelledby="picks-title">
      <SectionHeading id="picks-title" title="منتخب کسری" href="/shop?sort=featured" linkLabel="مشاهده‌ی همه"/>
      <ProductRail products={picks} label="منتخب کسری"/>
    </section>

    <nav className="container service-links" aria-label="راهنمای خرید از کسری">
      <Link href="/size-guide"><span><strong>راهنمای انتخاب سایز</strong><small>اندازه‌گیری درست، قبل از انتخاب</small></span><span className="arrow-disc" aria-hidden="true"><ArrowUpLeft size={20}/></span></Link>
      <Link href="/shipping-and-returns"><span><strong>ارسال و بازگشت</strong><small>اطلاعات نمونه، هنوز نهایی نشده</small></span><span className="arrow-disc" aria-hidden="true"><ArrowUpLeft size={20}/></span></Link>
      <Link href="/faq"><span><strong>سؤال‌های پرتکرار</strong><small>پاسخ کوتاه به پرسش‌های رایج</small></span><span className="arrow-disc" aria-hidden="true"><ArrowUpLeft size={20}/></span></Link>
    </nav>

    <section className="container newsletter" aria-labelledby="closing-title">
      <span className="newsletter-figure"><Image src={lookbookPhotos.tshirtWhite} alt="" fill sizes="(max-width: 600px) 46vw, 300px"/></span>
      <div className="newsletter-copy"><h2 id="closing-title">یک انتخاب برای امروز، یک استایل به سبک تو.</h2><p>لباس‌های موردعلاقه‌ات را پیدا کن و با علامت قلب برای بعد نگه دار.</p></div>
      <Link href="/shop" className="btn btn-primary">دیدن همه لباس‌ها <ArrowLeft size={18} aria-hidden="true"/></Link>
    </section>
  </>;
}
