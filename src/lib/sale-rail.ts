import { discountPercent } from '@/lib/format';
import type { Product } from '@/types/store';

/** How many cards the home page's sale rail holds; «مشاهده همه» opens the rest in the shop. */
const SALE_RAIL_LIMIT = 10;
/** Fewer than this and the red panel would frame a single card, so the section is left out. */
const SALE_RAIL_MIN = 2;

export type SaleRailItem = Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'compareAt'> & { image: string; percent: number };
export type SaleRail = { items: SaleRailItem[]; total: number; maxPercent: number };

/** The home page's sale rail: discounted products that can still be bought, the biggest discount first and the newest
 * first among equal discounts. Only what a card shows goes to the page (the first photo, prices and the discount). */
export function getSaleRail(products: Product[]): SaleRail | null {
  const onSale = products
    .map(product => ({ product, percent: discountPercent(product.price, product.compareAt) }))
    .filter(({ product, percent }) => percent > 0 && product.variants.some(variant => variant.stock > 0))
    .sort((a, b) => b.percent - a.percent || b.product.createdAt.localeCompare(a.product.createdAt));
  if (onSale.length < SALE_RAIL_MIN) return null;
  const items = onSale.slice(0, SALE_RAIL_LIMIT).map(({ product: { id, slug, name, price, compareAt, images }, percent }) =>
    ({ id, slug, name, price, compareAt, image: images[0], percent }));
  return { items, total: onSale.length, maxPercent: items[0].percent };
}
