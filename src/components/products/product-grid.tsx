import { ProductCard } from '@/components/products/product-card';
import type { ProductCardData } from '@/components/products/product-card';

/** `eagerCount` marks the first row as above the fold: the first image is the LCP candidate
 * (preloaded, high priority); the rest load eagerly without competing for bandwidth. */
export function ProductGrid({ products, eagerCount = 0 }: { products: ProductCardData[]; eagerCount?: number }) {
  return <div className="product-grid">
    {products.map((product, index) => <ProductCard key={product.id} product={product}
      loading={index === 0 && eagerCount > 0 ? 'lcp' : index < eagerCount ? 'eager' : 'lazy'}/>)}
  </div>;
}
