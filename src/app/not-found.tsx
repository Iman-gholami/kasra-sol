import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { categories } from '@/data/facets';

export default function NotFound() {
  return <div className="container">
    <div className="confirmation not-found">
      <p className="section-kicker">خطای ۴۰۴</p>
      <h1>این صفحه پیدا نشد</h1>
      <p>شاید نشانی تغییر کرده یا اشتباه تایپ شده. می‌توانی جستجو کنی یا از یکی از کالکشن‌ها شروع کنی.</p>
      <form action="/search" role="search" className="search-line">
        <Search size={20} aria-hidden="true"/>
        <input type="search" name="q" aria-label="جستجو در کسری" placeholder="مثلاً مانتو مشکی" required enterKeyHint="search"/>
        <button type="submit" className="btn btn-primary btn-sm">جستجو</button>
      </form>
      <div className="empty-actions">
        {categories.map(category => <Link key={category.slug} className="chip" href={'/category/' + category.slug}>{category.title}</Link>)}
        <Link href="/" className="btn btn-ghost">بازگشت به خانه <ArrowLeft size={18} aria-hidden="true"/></Link>
      </div>
    </div>
  </div>;
}
