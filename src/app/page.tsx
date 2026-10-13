import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft, ArrowUpRight, MoveLeft } from 'lucide-react';
import { categories, products } from '@/data/products';
import { ProductGrid } from '@/components/products/product-grid';

const categoryPhotos = [
  '/images/lookbook/shomiz-rose.avif',
  '/images/lookbook/manto-sage.avif',
  '/images/lookbook/tshirt-blue.avif'
];

export default function HomePage() {
  const arrivals = [...products].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,4);
  const picks = ['manto-03', 'shomiz-06', 'tshirt-02', 'manto-08'].map(slug => products.find(p => p.slug === slug)!).filter(Boolean);

  return <>
    <section className="hero container wide-editorial" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="hero-pretitle"><span className="overline-rule"/><span>انتخاب‌های تازه، هر روز</span></div>
        <h1 id="hero-title">استایل هر روزت، <em>به سبک خودت.</em></h1>
        <p>از یک شومیز دوست‌داشتنی تا مانتویی که هر روز سراغش می‌ری؛ انتخاب‌های ساده برای سلیقه تو.</p>
        <div className="hero-actions">
          <Link href="/shop" className="btn btn-dark btn-large">کالکشن رو ببین <ArrowLeft size={19}/></Link>
          <Link href="/category/shomiz" className="text-link">شومیزها <MoveLeft size={18}/></Link>
        </div>
        <div className="hero-category-links" aria-label="دسته‌بندی‌های فروشگاه">
  {categories.map(item => <Link key={item.slug} href={'/category/'+item.slug}>{item.title}<ArrowUpLeft size={15} aria-hidden="true"/></Link>)}
</div>
      </div>
      <div className="hero-visual">
        <Image src="/images/lookbook/shomiz-cream.avif" alt="عکس نمایشی مدل با شومیز روشن، ساخته‌شده با هوش مصنوعی" fill priority sizes="(max-width: 600px) 100vw, 54vw"/>
        <span className="hero-stamp" dir="ltr">THE KASRA EDIT <span>COLLECTION / 01</span></span>
      </div>
    </section>

    <section className="container section-block category-section" aria-labelledby="categories-title">
      <div className="section-heading"><div><p className="section-kicker">از کجا شروع کنیم؟</p><h2 id="categories-title">کالکشن‌ها رو کشف کن</h2></div><p>هر روز، یک سبک تازه از خودت.</p></div>
      <div className="category-grid">
        {categories.map((category,i) => <Link key={category.slug} href={'/category/'+category.slug} className={'category-tile category-'+i}>
          <Image src={categoryPhotos[i]} alt={'نمایش تصویری کالکشن '+category.title} fill sizes="(max-width: 580px) 50vw, 33vw"/>
          <span className="category-index" dir="ltr">0{i+1} / 03</span>
          <div className="category-description"><h3>{category.title}</h3><p>{category.description}</p></div>
          <span className="category-arrow" aria-hidden="true"><ArrowUpLeft size={19}/></span>
        </Link>)}
      </div>
      <p className="demo-photo-note">تصاویر این نسخه با هوش مصنوعی ساخته شده‌اند و برای نمایش حال‌وهوای فروشگاه هستند.</p>
    </section>

    <section className="container section-block" aria-labelledby="arrivals-title">
      <div className="section-heading"><div><p className="section-kicker">انتخاب تازه</p><h2 id="arrivals-title">تازه رسیده‌ها</h2></div>
        <Link className="text-link" href="/shop?sort=newest">مشاهده همه <ArrowLeft size={18}/></Link></div>
      <ProductGrid products={arrivals}/>
    </section>

    <section className="container wide-editorial editorial-band" aria-labelledby="edit-title">
      <div className="editorial-art">
        <Image src="/images/lookbook/manto-black.avif" alt="عکس نمایشی مانتوی مشکی بر تن مدل" fill sizes="(max-width: 580px) 100vw, 46vw"/>
        <span className="editorial-image-index" dir="ltr">THE EDIT / 2026</span>
      </div>
      <div className="editorial-copy">
        <span className="editorial-super" dir="ltr">THE KASRA EDIT / 02</span>
        <h2 id="edit-title">انتخاب‌هایی برای <em>استایلِ خودت</em></h2>
        <p>ترکیب‌های بی‌دردسر و رنگ‌هایی که همیشه می‌شه دوست‌شون داشت.</p>
        <Link href="/category/manto" className="text-link">مانتوهای کسری <ArrowLeft size={18}/></Link>
      </div>
    </section>

    <section className="container section-block" aria-labelledby="picks-title">
      <div className="section-heading"><div><p className="section-kicker">از میان کالکشن‌ها</p><h2 id="picks-title">منتخب کسری</h2></div>
        <Link className="text-link" href="/shop?sort=featured">همه پیشنهادها <ArrowLeft size={18}/></Link></div>
      <ProductGrid products={picks}/>
    </section>

    <nav className="container service-links" aria-label="راهنمای خرید از کسری">
      <Link href="/size-guide"><span>۰۱ / راهنمای انتخاب سایز</span><ArrowUpRight size={19}/></Link>
      <Link href="/shipping-and-returns"><span>۰۲ / اطلاعات ارسال و بازگشت</span><ArrowUpRight size={19}/></Link>
      <Link href="/faq"><span>۰۳ / پاسخ به سؤال‌ها</span><ArrowUpRight size={19}/></Link>
    </nav>

    <section className="container newsletter">
      <div><h2>یک انتخاب برای امروز، یک استایل به سبک تو.</h2><p>لباس‌های موردعلاقه‌ات را پیدا کن و برای بعد ذخیره کن.</p></div>
      <Link href="/shop" className="btn btn-dark">دیدن همه لباس‌ها <ArrowLeft size={18}/></Link>
    </section>
  </>;
}
