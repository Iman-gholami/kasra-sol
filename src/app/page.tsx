import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft, Info } from 'lucide-react';
import { categories } from '@/data/products';
import { getHomeProducts } from '@/lib/backend-products';
import { ProductGrid } from '@/components/products/product-grid';
import { ShopByColor } from '@/components/home/shop-by-color';
import { getShopByColorResults } from '@/lib/shop-by-color';

const categoryPhotos = [
  '/images/lookbook/shomiz-rose.avif',
  '/images/lookbook/manto-sage.avif',
  '/images/lookbook/tshirt-blue.avif'
];
// The first tile is wider on desktop; the last spans the full width on phones.
const categorySizes = [
  '(max-width: 600px) 50vw, (max-width: 1520px) 40vw, 600px',
  '(max-width: 600px) 50vw, (max-width: 1520px) 30vw, 460px',
  '(max-width: 600px) 100vw, (max-width: 1520px) 30vw, 460px'
];

export const dynamic = 'force-dynamic';
export default async function HomePage() {
  const products = await getHomeProducts();
  const arrivals = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const picks = ['manto-03', 'shomiz-06', 'tshirt-02', 'manto-08'].map(slug => products.find(p => p.slug === slug)!).filter(Boolean);
  const colors = getShopByColorResults();

  return <>
    <section className="hero container wide-editorial" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-pretitle"><span className="overline-rule" aria-hidden="true"/>انتخاب‌های تازه، هر روز</p>
        <h1 id="hero-title">استایل هر روزت، <em>به سبک خودت.</em></h1>
        <p className="hero-lede">از یک شومیز دوست‌داشتنی تا مانتویی که هر روز سراغش می‌ری؛ انتخاب‌های ساده برای سلیقه تو.</p>
        <div className="hero-actions">
          <Link href="/shop" className="btn btn-primary btn-lg">کالکشن رو ببین <ArrowLeft size={19} aria-hidden="true"/></Link>
          <Link href="/shop?sort=newest" className="text-link">تازه‌ترین‌ها</Link>
        </div>
        <nav className="hero-category-links" aria-label="میان‌بُر دسته‌بندی‌ها">
          {categories.map(item => <Link key={item.slug} href={'/category/' + item.slug}>{item.title}<ArrowUpLeft size={16} aria-hidden="true"/></Link>)}
        </nav>
      </div>
      <div className="hero-visual">
        <Image src="/images/lookbook/shomiz-cream.avif" alt="عکس نمایشی مدل با شومیز روشن، ساخته‌شده با هوش مصنوعی" fill preload fetchPriority="high"
          sizes="(max-width: 600px) 100vw, (max-width: 1520px) 56vw, 860px"/>
      </div>
    </section>

    <section className="container section-block category-section" aria-labelledby="categories-title">
      <div className="section-heading">
        <div><p className="section-kicker">از کجا شروع کنیم؟</p><h2 id="categories-title">کالکشن‌ها رو کشف کن</h2></div>
        <p>هر روز، یک سبک تازه از خودت.</p>
      </div>
      <ul className="category-grid">
        {categories.map((category, i) => <li key={category.slug}>
          <Link href={'/category/' + category.slug} className={'category-tile category-' + i}>
            <Image src={categoryPhotos[i]} alt="" fill sizes={categorySizes[i]}/>
            <span className="category-description"><span className="category-name">{category.title}</span><span>{category.description}</span></span>
            <span className="category-arrow" aria-hidden="true"><ArrowUpLeft size={20}/></span>
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
        <Image src="/images/lookbook/manto-black.avif" alt="عکس نمایشی مانتوی مشکی بر تن مدل" fill sizes="(max-width: 600px) 100vw, (max-width: 1520px) 46vw, 700px"/>
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
      <Link href="/size-guide"><span><strong>راهنمای انتخاب سایز</strong><small>اندازه‌گیری درست، قبل از انتخاب</small></span><ArrowUpLeft size={20} aria-hidden="true"/></Link>
      <Link href="/shipping-and-returns"><span><strong>ارسال و بازگشت</strong><small>اطلاعات نمونه، هنوز نهایی نشده</small></span><ArrowUpLeft size={20} aria-hidden="true"/></Link>
      <Link href="/faq"><span><strong>سؤال‌های پرتکرار</strong><small>پاسخ کوتاه به پرسش‌های رایج</small></span><ArrowUpLeft size={20} aria-hidden="true"/></Link>
    </nav>

    <section className="container newsletter" aria-labelledby="closing-title">
      <div><h2 id="closing-title">یک انتخاب برای امروز، یک استایل به سبک تو.</h2><p>لباس‌های موردعلاقه‌ات را پیدا کن و با علامت قلب برای بعد نگه دار.</p></div>
      <Link href="/shop" className="btn btn-primary">دیدن همه لباس‌ها <ArrowLeft size={18} aria-hidden="true"/></Link>
    </section>
  </>;
}
