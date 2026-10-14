import Image from 'next/image';
import Link from 'next/link';
import { categories } from '@/data/facets';
import { WishlistButton } from '@/components/products/wishlist-button';
import { Price } from '@/components/products/price';
import { discountPercent, formatNumber, formatPercent } from '@/lib/format';
import type { Product } from '@/types/store';

export type ProductCardData = Pick<Product,
  'id' | 'slug' | 'name' | 'category' | 'price' | 'compareAt' | 'images' | 'colors'> & Partial<Pick<Product, 'variants'>>;

const SIZES = '(max-width: 600px) 46vw, (max-width: 1080px) 31vw, (max-width: 1439px) 24vw, 330px';

/** Server-rendered card: one stretched title link (one tab stop) plus the wishlist toggle island. */
export function ProductCard({ product, priority = false, sizes = SIZES }: { product: ProductCardData; priority?: boolean; sizes?: string }) {
  const discount = discountPercent(product.price, product.compareAt);
  const category = categories.find(item => item.slug === product.category)?.title ?? '';
  const soldOut = product.variants ? !product.variants.some(variant => variant.stock > 0) : false;
  const href = '/product/' + product.slug;
  return <article className={'product-card' + (soldOut ? ' is-sold-out' : '')}>
    <div className="product-visual">
      <Link className="product-image-link" href={href} tabIndex={-1} aria-hidden="true">
        <Image src={product.images[0]} alt="" fill sizes={sizes} priority={priority}/>
      </Link>
      {soldOut ? <span className="product-badge">ناموجود</span>
        : discount > 0 && <span className="product-badge discount-tag">{formatPercent(discount)} تخفیف</span>}
      <WishlistButton productId={product.id} productName={product.name}/>
    </div>
    <div className="product-info">
      <p className="product-category">{category}</p>
      <h3 className="product-title"><Link href={href} className="product-link">{product.name}</Link></h3>
      <Price price={product.price} compareAt={product.compareAt}/>
      <div className="color-dots" aria-hidden="true">
        {product.colors.map(color => <span key={color.id} style={{ backgroundColor: color.hex }}/>)}
        <small>{formatNumber(product.colors.length)} رنگ</small>
      </div>
      <p className="sr-only">رنگ‌ها: {product.colors.map(color => color.name).join('، ')}</p>
    </div>
  </article>;
}
