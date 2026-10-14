'use client';

import Link from 'next/link';
import { ArrowLeft, Heart } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { products } from '@/data/products';
import { ProductGrid } from '@/components/products/product-grid';
import { formatNumber } from '@/lib/format';

export function WishlistPage() {
  const { wishlist, hydrated } = useShop();
  const chosen = products.filter(product => wishlist.includes(product.id));
  if (!hydrated) return <div className="wishlist-skeleton" role="status" aria-label="در حال بارگذاری علاقه‌مندی‌ها">
    {[0, 1, 2, 3].map(i => <span key={i} className="skeleton" aria-hidden="true"/>)}
  </div>;
  return chosen.length
    ? <>
      <p className="cart-summary-line">{formatNumber(chosen.length)} مدل ذخیره‌شده، فقط در همین مرورگر</p>
      <h2 className="sr-only">لباس‌های ذخیره‌شده</h2>
      <ProductGrid products={chosen}/>
    </>
    : <div className="empty-state">
      <Heart size={34} strokeWidth={1.4} aria-hidden="true"/>
      <h2>اینجا هنوز خالیه</h2>
      <p>با علامت قلب روی هر لباس، آن را برای بعد نگه دار. فهرست فقط در همین مرورگر ذخیره می‌شود.</p>
      <Link className="btn btn-primary" href="/shop">پیدا کردن لباس <ArrowLeft size={18} aria-hidden="true"/></Link>
    </div>;
}
