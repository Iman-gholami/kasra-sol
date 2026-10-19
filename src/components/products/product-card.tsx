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

/** How the card image loads: `lcp` = preloaded at high fetch priority (the page's LCP candidate),
 * `eager` = above the fold but not competing with the LCP image, `lazy` = below the fold. */
export type CardImageLoading = 'lcp' | 'eager' | 'lazy';

/** Server-rendered card: one stretched title link (one tab stop) plus the wishlist toggle island.
 * A second photo, when there is one, crossfades in on hover with a fine pointer and is a swipe away on touch
 * screens (a CSS scroll-snap track with a scroll-driven position bar; no client JavaScript). */
export function ProductCard({ product, loading = 'lazy', sizes = SIZES }: { product: ProductCardData; loading?: CardImageLoading; sizes?: string }) {
  const discount = discountPercent(product.price, product.compareAt);
  const category = categories.find(item => item.slug === product.category)?.title ?? '';
  const soldOut = product.variants ? !product.variants.some(variant => variant.stock > 0) : false;
  const href = '/product/' + product.slug;
  const [photo, alternate] = product.images;
  return <article className={'product-card' + (soldOut ? ' is-sold-out' : '')}>
    <div className="product-visual">
      <Link className="product-image-link" href={href} tabIndex={-1} aria-hidden="true">
        <span className="product-slide">
          <Image src={photo} alt="" fill sizes={sizes} preload={loading === 'lcp'}
            fetchPriority={loading === 'lcp' ? 'high' : undefined} loading={loading === 'eager' ? 'eager' : undefined}/>
        </span>
        {alternate && <span className="product-slide"><Image src={alternate} alt="" fill sizes={sizes} fetchPriority="low"/></span>}
      </Link>
      {alternate && <span className="product-photo-bar" aria-hidden="true"/>}
      {soldOut ? <span className="product-badge">ناموجود</span>
        : discount > 0 && <span className="product-badge discount-tag">{formatPercent(discount)} تخفیف</span>}
      <WishlistButton productId={product.id} productName={product.name}/>
    </div>
    <div className="product-info">
      <p className="product-category">{category}</p>
      <h3 className="product-title"><Link href={href} className="product-link"><span>{product.name}</span></Link></h3>
      <Price price={product.price} compareAt={product.compareAt}/>
      <div className="color-dots" aria-hidden="true">
        {product.colors.map(color => <span key={color.id} style={{ backgroundColor: color.hex }}/>)}
        <small>{formatNumber(product.colors.length)} رنگ</small>
      </div>
      <p className="sr-only">رنگ‌ها: {product.colors.map(color => color.name).join('، ')}</p>
    </div>
  </article>;
}
