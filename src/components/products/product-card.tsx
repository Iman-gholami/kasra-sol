'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { discountPercent, formatPercent, toman } from '@/lib/format';
import styles from '@/components/products/product-card.module.css';
import type { Product } from '@/types/store';

export type ProductCardData = Pick<Product,
  'id' | 'slug' | 'name' | 'category' | 'price' | 'compareAt' | 'images' | 'colors'> & {
  /** A server-derived shade preview; absence of image means no accurate photo exists. */
  colorPreview?: { slug: string; name: string; hex: string; image?: string; inStock: boolean };
};

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const { wishlist, toggleWishlist, hydrated } = useShop();
  const liked = hydrated && wishlist.includes(product.id);
  const discount = discountPercent(product.price, product.compareAt);
  const category = product.category === 'shomiz' ? 'شومیز' : product.category === 'manto' ? 'مانتو' : 'تیشرت';
  const displayImage = product.colorPreview ? product.colorPreview.image : product.images[0];

  return <article className="product-card" data-color-family={product.colorPreview?.slug}>
    <div className="product-visual">
      <Link className="product-image-link" href={'/product/'+product.slug} aria-label={'مشاهده '+product.name}>
        {displayImage ?
          <Image src={displayImage}
            alt={product.colorPreview
              ? 'عکس استایل نمایشی برای '+category+' در رنگ '+product.colorPreview.name+'؛ عکس اختصاصی این محصول نیست'
              : 'تصویر مدل نمایشی برای دسته '+category+'؛ عکس واقعی این محصول نیست'}
            fill sizes="(max-width: 600px) 47vw, (max-width: 810px) 45vw, (max-width: 1080px) 30vw, 25vw"
            priority={priority}/> :
          <span className={styles.colorPlaceholder} role="img"
            aria-label={'نمونه رنگ '+product.colorPreview?.name+'؛ تصویر اختصاصی این رنگ موجود نیست'}>
            <span className={styles.largeSwatch} style={{backgroundColor: product.colorPreview?.hex}} aria-hidden="true" />
            <span className={styles.placeholderText}>تصویر این رنگ موجود نیست</span>
          </span>}
      </Link>
      {discount > 0 && <span className="discount-tag">{formatPercent(discount)} تخفیف</span>}
      {product.colorPreview && <span className={styles.previewBadge}>
        <span className={styles.badgeSwatch} style={{backgroundColor:product.colorPreview.hex}} aria-hidden="true"/>
        {product.colorPreview.name}
      </span>}
      <button type="button" className={'wishlist-button'+(liked?' is-liked':'')}
        aria-label={(liked?'حذف از علاقه‌مندی‌ها: ':'افزودن به علاقه‌مندی‌ها: ')+product.name}
        aria-pressed={liked} onClick={() => toggleWishlist(product.id)}>
        <Heart size={19} strokeWidth={1.7} fill={liked?'currentColor':'none'}/>
      </button>
    </div>
    <div className="product-info">
      <p className="product-category">{category}
        {product.colorPreview && !product.colorPreview.inStock &&
          <span className={styles.unavailable}>ناموجود در این رنگ</span>}
      </p>
      <h3><Link href={'/product/'+product.slug}>{product.name}</Link></h3>
      <div className="price-line"><strong>{toman(product.price)}</strong>{product.compareAt && <del>{toman(product.compareAt)}</del>}</div>
      <div className="card-bottom">
        <div className="color-dots" aria-label="رنگ‌های فهرست‌شده">{product.colors.map(color =>
          <span title={color.name} key={color.id} style={{backgroundColor:color.hex}}/>)}</div>
        <Link href={'/product/'+product.slug} className="subtle-link" aria-label={'مشاهده جزئیات و انتخاب سایز '+product.name}>انتخاب سایز <ArrowText/></Link>
      </div>
    </div>
  </article>;
}

function ArrowText() { return <span aria-hidden="true">←</span>; }
