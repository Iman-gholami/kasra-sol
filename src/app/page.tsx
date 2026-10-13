import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowUpLeft, HeartHandshake, MoveLeft, Shirt, Sparkles } from 'lucide-react';
import { categories, products } from '@/data/products';
import { ProductGrid } from '@/components/products/product-grid';

export default function HomePage() {
  const arrivals = [...products].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,4);
  const picks = products.filter((product) => product.featured && product.category !== 'tshirt').slice(0,4);
  return <>
    <section className="hero container">
      <div className="hero-copy">
        <span className="eyebrow">NEW MOOD · EVERY DAY</span>
        <h1>استایل هر روزت، <em>به سبک خودت.</em></h1>
        <p>گاهی یک انتخاب ساده، حال‌وهوای روز را عوض می‌کند. لباس‌هایی برای تو، با سلیقه خودت.</p>
        <div className="hero-actions"><Link href="/shop" className="btn btn-dark btn-large">مشاهده محصولات <ArrowLeft size={19} /></Link><Link href="/category/shomiz" className="text-link">کالکشن شومیز <MoveLeft size={18} /></Link></div>
        <div className="hero-note">KASRA · YOUR EVERYDAY EDIT</div>
      </div>
      <div className="hero-visual"><Image src="/images/lookbook/shomiz-cream.avif" alt="عکس نمایشی مدل با شومیز کرم، ساخته‌شده با هوش مصنوعی" fill priority sizes="(max-width: 780px) 100vw, 50vw" /><span className="hero-stamp">01 / 03<br />THE EDIT</span></div>
    </section>
    <section className="container section-block"><div className="section-heading"><div><p className="eyebrow">DISCOVER YOUR STYLE</p><h2>از کجا شروع کنیم؟</h2></div><p>سه انتخاب ساده برای استایل‌های متفاوت.</p></div>
      <div className="category-grid">{categories.map((category, i) => <Link key={category.slug} className={'category-tile category-' + i} href={'/category/' + category.slug}>
        <span className="category-index">0{i + 1}</span><div><h3>{category.title}</h3><p>{category.description}</p></div><ArrowUpLeft size={25} />
      </Link>)}</div>
    </section>
    <section className="container section-block"><div className="section-heading"><div><p className="eyebrow">FRESHLY SELECTED</p><h2>تازه رسیده‌ها</h2></div><Link className="text-link" href="/shop?sort=newest">دیدن همه <ArrowLeft size={18} /></Link></div><ProductGrid products={arrivals} /></section>
    <section className="container editorial-band"><div className="editorial-art"><Sparkles size={58} strokeWidth={1} /><span>CURATED / KASRA</span></div><div><p className="eyebrow">SIMPLY YOU</p><h2>سادگی، همیشه شیکه.</h2><p>رنگ‌های آرام، برش‌های فکرشده و استایلی که مال توست.</p><Link href="/category/manto" className="btn btn-dark">دیدن مانتوها <ArrowLeft size={18} /></Link></div></section>
    <section className="container section-block"><div className="section-heading"><div><p className="eyebrow">OUR FAVORITES</p><h2>انتخاب‌های کسری</h2></div><Link className="text-link" href="/shop?sort=featured">همه پیشنهادها <ArrowLeft size={18} /></Link></div><ProductGrid products={picks} /></section>
    <section className="container values-row"><div><Shirt size={27} /><h3>انتخاب راحت</h3><p>مشخصات و سایزبندی روشن در هر صفحه محصول</p></div><div><HeartHandshake size={27} /><h3>بدون عجله</h3><p>محصولات را ذخیره کن و هر وقت خواستی برگرد</p></div><div><Sparkles size={27} /><h3>استایل شخصی</h3><p>ترکیب‌های ساده برای سلیقه‌های متفاوت</p></div></section>
    <section className="container newsletter"><div><p className="eyebrow">STAY IN THE LOOP</p><h2>از کالکشن بعدی باخبر شو</h2><p>عضویت خبرنامه در این نمونه هنوز متصل نیست.</p></div><Link className="btn btn-outline" href="/contact">راه‌های ارتباطی <ArrowLeft size={18} /></Link></section>
  </>;
}
