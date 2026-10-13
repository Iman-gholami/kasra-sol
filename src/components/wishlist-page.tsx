'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { products } from '@/data/products';
import { ProductGrid } from '@/components/products/product-grid';

export function WishlistPage() {
  const { wishlist, hydrated } = useShop();
  const chosen = products.filter((product) => wishlist.includes(product.id));
  if (!hydrated) return <div className="container loading-skeleton" role="status" aria-label="بارگذاری علاقه‌مندی‌ها" />;
  return <div className="container"><h1 className="page-heading">علاقه‌مندی‌های من</h1>
    {chosen.length ? <div className="section-block" style={{paddingTop:10}}><ProductGrid products={chosen} /></div> :
      <div className="empty-state"><Heart size={34} strokeWidth={1.4} /><h2>اینجا هنوز خالیه</h2><p>لباس‌های موردعلاقه‌ات را با علامت قلب ذخیره کن.</p><Link className="btn btn-dark" href="/shop">پیدا کردن لباس</Link></div>}
  </div>;
}
