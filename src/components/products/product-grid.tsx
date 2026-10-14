import { ProductCard } from '@/components/products/product-card';
import type { ProductCardData } from '@/components/products/product-card';

export function ProductGrid({ products, priorityFirst = false }: { products: ProductCardData[]; priorityFirst?: boolean }) {
  return <div className="product-grid">{products.map((product, index) => <ProductCard key={product.id} product={product} priority={priorityFirst && index === 0} />)}</div>;
}
