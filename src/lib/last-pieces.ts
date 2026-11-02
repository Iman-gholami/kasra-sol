import type { Product, ProductVariant } from '@/types/store';

/** How many cards the home page's «آخرین دونه‌ها» rail holds; «مشاهده همه» opens the rest in the shop (`last=1`). */
const LAST_PIECES_LIMIT = 10;

export type LastPiece = Pick<Product, 'id' | 'slug' | 'name' | 'price' | 'compareAt'> & {
  image: string; color: { name: string; hex: string }; size: string;
};
export type LastPieces = { items: LastPiece[]; total: number };

/** The one unit a model has left, when its stock across every colour and size adds up to exactly one. */
export function lastPieceOf(product: Product): ProductVariant | undefined {
  const total = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  return total === 1 ? product.variants.find(variant => variant.stock === 1) : undefined;
}

/** The home page's «آخرین دونه‌ها»: models down to their very last piece, newest first, each with the colour and size
 * that is left. Only what a card shows goes to the page. Left out when there are none. */
export function getLastPieces(products: Product[]): LastPieces | null {
  const found = products
    .map(product => ({ product, piece: lastPieceOf(product) }))
    .filter((entry): entry is { product: Product; piece: ProductVariant } => Boolean(entry.piece))
    .sort((a, b) => b.product.createdAt.localeCompare(a.product.createdAt));
  if (!found.length) return null;
  const items = found.slice(0, LAST_PIECES_LIMIT).map(({ product: { id, slug, name, price, compareAt, images, colors }, piece }) => {
    const color = colors.find(entry => entry.id === piece.colorId);
    return { id, slug, name, price, compareAt, image: images[0],
      color: { name: color?.name ?? piece.colorId, hex: color?.hex ?? 'transparent' }, size: piece.size };
  });
  return { items, total: found.length };
}
