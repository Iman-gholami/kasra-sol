import { ProductCard } from '@/components/products/product-card';
import type { ProductCardData } from '@/components/products/product-card';

/** `priorityCount` marks above-the-fold images (first row) as LCP candidates instead of lazy. */
export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return <div className="product-grid">
    {products.map((product, index) => <ProductCard key={product.id} product={product} priority={index < priorityCount}/>)}
  </div>;
}
