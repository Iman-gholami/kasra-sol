import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft, Heart, Layers3, MoveLeft, Sparkles } from 'lucide-react';
import { categories, products } from '@/data/products';
import { ProductGrid } from '@/components/products/product-grid';

const categoryPhotos = [
  '/images/lookbook/shomiz-rose.avif',
  '/images/lookbook/manto-sage.avif',
  '/images/lookbook/tshirt-blue.avif'
];

export default function HomePage() {
  const arrivals = [...products].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,4);
  const picks = products.filter(product => product.featured && product.category !== 'tshirt').slice(0,4);

  return <>
    <section className="hero container" aria-labelledby="hero-title">
      <div className="hero-copy">
        <div className="hero-pretitle"><span className="overline-rule"/><span dir="ltr">KASRA / THE EVERYDAY EDIT</span></div>
        <h1 id="hero-title">استایل هر روزت، <em>به سبک خودت.</em></h1>
        <p>از یک شومیز دوست‌داشتنی تا مانتویی که هر روز سراغش می‌ری؛ انتخاب‌های ساده برای سلیقه تو.</p>
        <div className="hero-actions">
          <Link href="/shop" className="btn btn-dark btn-large">کالکشن رو ببین <ArrowLeft size={19}/></Link>
          <Link href="/category/shomiz" className="text-link">شومیزها <MoveLeft size={18}/></Link>
        </div>
        <span className="hero-note" dir="ltr">EVERYDAY, BEAUTIFULLY STYLED / 01</span>
      </div>
      <div className="hero-visual">
        <Image src="/images/lookbook/shomiz-cream.avif" alt="عکس نمایشی مدل با شومیز روشن، ساخته‌شده با هوش مصنوعی" fill priority sizes="(max-width: 600px) 100vw, 54vw"/>
        <span className="hero-stamp" dir="ltr">KASRA STUDIO <span>01 — 26</span></span>
      </div>
    </section>

    <section className="container section-block category-section" aria-labelledby="categories-title">
      <div className="section-heading"><div><p className="eyebrow">FIND YOUR FAVORITE</p><h2 id="categories-title">کالکشن‌ها رو کشف کن</h2></div><p>هر روز، یک سبک تازه از خودت.</p></div>
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
      <div className="section-heading"><div><p className="eyebrow">JUST ARRIVED</p><h2 id="arrivals-title">تازه رسیده‌ها</h2></div>
        <Link className="text-link" href="/shop?sort=newest">مشاهده همه <ArrowLeft size={18}/></Link></div>
      <ProductGrid products={arrivals}/>
    </section>

    <section className="container editorial-band" aria-labelledby="edit-title">
      <div className="editorial-art">
        <Image src="/images/lookbook/manto-black.avif" alt="عکس نمایشی مانتوی مشکی بر تن مدل" fill sizes="(max-width: 580px) 100vw, 46vw"/>
        <span className="editorial-image-index" dir="ltr">THE EDIT / 2026</span>
      </div>
      <div className="editorial-copy">
        <span className="editorial-super" dir="ltr">A LITTLE MORE YOU.</span>
        <p className="eyebrow">THE KASRA EDIT</p>
        <h2 id="edit-title">انتخاب‌هایی برای <em>استایلِ خودت</em></h2>
        <p>ترکیب‌های بی‌دردسر و رنگ‌هایی که همیشه می‌شه دوست‌شون داشت.</p>
        <Link href="/category/manto" className="text-link">مانتوهای کسری <ArrowLeft size={18}/></Link>
      </div>
    </section>

    <section className="container section-block" aria-labelledby="picks-title">
      <div className="section-heading"><div><p className="eyebrow">SELECTED FOR YOU</p><h2 id="picks-title">منتخب کسری</h2></div>
        <Link className="text-link" href="/shop?sort=featured">همه پیشنهادها <ArrowLeft size={18}/></Link></div>
      <ProductGrid products={picks}/>
    </section>

    <section className="container values-row" aria-label="امکانات خرید نمایشی">
      <div><Layers3 size={25} strokeWidth={1.5}/><h3>انتخابی راحت‌تر</h3><p>مشخصات، رنگ و سایز در صفحه هر لباس</p></div>
      <div><Heart size={25} strokeWidth={1.5}/><h3>برای بعد نگهش دار</h3><p>ذخیره لباس‌های دوست‌داشتنی در علاقه‌مندی‌ها</p></div>
      <div><Sparkles size={25} strokeWidth={1.5}/><h3>به سبک تو</h3><p>انتخاب‌های مینیمال برای ترکیب‌های شخصی</p></div>
    </section>

    <section className="container newsletter">
      <div><p className="eyebrow">MORE FROM KASRA</p><h2>سؤالی درباره کسری داری؟</h2><p>اطلاعات و راه‌های ارتباطی در صفحه تماس توضیح داده شده‌اند.</p></div>
      <Link href="/contact" className="btn btn-outline">ارتباط با کسری <ArrowLeft size={18}/></Link>
    </section>
  </>;
}
