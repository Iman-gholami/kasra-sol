import { discountPercent } from '@/lib/format';
import { offerFor, type Offer } from '@/lib/last-piece-discount';
import type { Product } from '@/types/store';

/** One colour in one size with exactly one unit left: a card of «آخرین دونه‌ها». */
export type LastPiece = {
  key: string; slug: string; name: string; image: string;
  color: { id: string; name: string; hex: string }; size: string;
  /** What it sells at; `percent` is its last-piece discount, 0 when the price is not lowered (setting off, or the
   * product's own sale is deeper). */
  offer: Offer; percent: number;
  /** The product page with this colour and size already chosen. */
  href: string;
};
export type LastPieces = { items: LastPiece[]; total: number; maxPercent: number };

/** Every variant at exactly one unit whose colour the product still has, newest product first, then in the product's
 * colour and size order. `limit` caps the items (the home rail shows ten), not the total. */
export function getLastPieces(products: Product[], limit?: number): LastPieces {
  const pieces = [...products]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap(product => product.colors.flatMap(color => product.sizes.flatMap(size => {
      const variant = product.variants.find(entry => entry.colorId === color.id && entry.size === size);
      if (variant?.stock !== 1) return [];
      const offer = offerFor(product, color.id, size);
      return [{ key: product.slug + ':' + color.id + ':' + size, slug: product.slug, name: product.name, image: product.images[0],
        color: { id: color.id, name: color.name, hex: color.hex }, size, offer,
        percent: variant.price !== undefined ? discountPercent(offer.price, offer.compareAt) : 0,
        href: '/product/' + product.slug + '?color=' + encodeURIComponent(color.id) + '&size=' + encodeURIComponent(size) }];
    })));
  return { items: limit === undefined ? pieces : pieces.slice(0, limit), total: pieces.length,
    maxPercent: Math.max(0, ...pieces.map(piece => piece.percent)) };
}
