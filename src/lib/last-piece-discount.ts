import { discountPercent } from '@/lib/format';
import type { ProductVariant } from '@/types/store';

/** The owner's last-piece discount (back office «تخفیف آخرین دونه‌ها»). */
export type LastPieceSetting = { enabled: boolean; percent: number };
/** What something sells at, and the struck price shown beside it when it is lower. */
export type Offer = { price: number; compareAt?: number };
/** For listings: the deepest last-piece discount among a product's variants, whether it covers every variant that can
 * still be bought, and the cheapest such offer. */
export type LastPieceDeal = { percent: number; everyVariant: boolean; offer: Offer };
type Priced = Offer & { variants: ProductVariant[] };

/** Demo mode has no back office: the demo shows the discount on, at 20%. */
export const DEMO_LAST_PIECE_SETTING: LastPieceSetting = { enabled: true, percent: 20 };
export const LAST_PIECE_PERCENT = { min: 5, max: 70 } as const;

const offer = (price: number, compareAt?: number): Offer => compareAt === undefined ? { price } : { price, compareAt };

/** What one variant sells at. Only a variant whose own stock is exactly 1 qualifies, and only while the setting is on;
 * the percent comes off the original (struck) price, rounded to the nearest 1,000 toman, and applies only when that is
 * cheaper than the product's price, so a deeper product sale is kept and the two never stack. */
export function variantOffer(base: Offer, stock: number, setting: LastPieceSetting): Offer {
  const own = offer(base.price, base.compareAt);
  if (!setting.enabled || stock !== 1) return own;
  const original = base.compareAt !== undefined && base.compareAt > base.price ? base.compareAt : base.price;
  const discounted = Math.round(original * (100 - setting.percent) / 100 / 1000) * 1000;
  return discounted < base.price ? { price: discounted, compareAt: original } : own;
}

/** The product with each qualifying variant carrying its own `price` and `compareAt`, and any stale ones removed.
 * Pure: returns a new object. */
export function withLastPieceOffers<T extends Priced>(product: T, setting: LastPieceSetting): T {
  return { ...product, variants: product.variants.map(({ colorId, size, stock }) => {
    const own = variantOffer(product, stock, setting);
    return own.price === product.price ? { colorId, size, stock } : { colorId, size, stock, ...own };
  }) };
}

/** The price of one colour in one size: the variant's own offer when it has one, else the product's. */
export function offerFor(product: Priced, colorId: string, size: string): Offer {
  const variant = product.variants.find(entry => entry.colorId === colorId && entry.size === size);
  return variant?.price !== undefined ? offer(variant.price, variant.compareAt) : offer(product.price, product.compareAt);
}

/** null when no variant has a last-piece offer. */
export function lastPieceDeal(product: Priced): LastPieceDeal | null {
  const deals = product.variants.filter(variant => variant.price !== undefined);
  if (!deals.length) return null;
  const cheapest = deals.reduce((low, variant) => variant.price! < low.price! ? variant : low);
  return {
    percent: Math.max(...deals.map(variant => discountPercent(variant.price!, variant.compareAt))),
    everyVariant: product.variants.filter(variant => variant.stock > 0).every(variant => variant.price !== undefined),
    offer: offer(cheapest.price!, cheapest.compareAt)
  };
}
