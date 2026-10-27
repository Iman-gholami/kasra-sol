import { ProductCard, type ProductCardData } from '@/components/products/product-card';

// About 2.3 cards in view on phones, three on tablets, four in the page width from 821px.
const RAIL_SIZES = '(max-width: 600px) 44vw, (max-width: 820px) 30vw, (max-width: 1439px) 24vw, 330px';

/** A row of product cards for the home page: a swipeable scroll-snap row up to 820px (native RTL scrolling, no
 * script), four columns from 821px where only the first four show. Cards share their rows (CSS subgrid), so names,
 * prices and colour dots line up across the row whatever the name's length. Server component: only the hearts hydrate. */
export function ProductRail({ products, label }: { products: ProductCardData[]; label: string }) {
  return <ul className="product-rail" aria-label={label}>
    {products.map(product => <li key={product.id}><ProductCard product={product} sizes={RAIL_SIZES}/></li>)}
  </ul>;
}
