import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLastPieces } from '@/lib/last-pieces';
import { withLastPieceOffers, type LastPieceSetting } from '@/lib/last-piece-discount';
import { byId, products } from '@/data/products';
import type { Product, ProductVariant } from '@/types/store';

const ON20: LastPieceSetting = { enabled: true, percent: 20 };
const base = byId('shomiz-02')!;
const cream = { id: 'cream', name: 'کرم', hex: '#e8d8c3' }, black = { id: 'black', name: 'مشکی', hex: '#222222' };
/** A product in cream and black, sizes M and L, priced through the setting; `stock` lists units per variant. */
function product(id: string, stock: Partial<Record<'cream-M' | 'cream-L' | 'black-M' | 'black-L', number>>,
  extra: Partial<Product> = {}, setting = ON20): Product {
  const variants: ProductVariant[] = (['cream-M', 'cream-L', 'black-M', 'black-L'] as const)
    .map(key => ({ colorId: key.split('-')[0], size: key.split('-')[1], stock: stock[key] ?? 0 }));
  return withLastPieceOffers({ ...base, id, slug: id, name: 'مدل ' + id, price: 900_000, compareAt: undefined,
    colors: [cream, black], sizes: ['M', 'L'], images: ['/' + id + '.avif'], variants,
    createdAt: '2026-09-01T00:00:00.000Z', ...extra }, setting);
}

describe('getLastPieces (per variant)', () => {
  it('lists the demo catalog\'s nine last pieces, newest product first, then colour and size order', () => {
    const rail = getLastPieces(products);
    assert.deepEqual(rail.items.map(p => [p.slug, p.color.id, p.size, p.offer.price]), [
      ['shomiz-04', 'white', 'M', 574_000], ['shomiz-06', 'black', 'L', 643_000], ['shomiz-07', 'rose', 'M', 678_000],
      ['manto-06', 'rose', 'M', 1_188_000], ['tshirt-05', 'cream', 'M', 424_000], ['manto-08', 'rose', 'S', 1_314_000],
      ['manto-08', 'cream', 'XL', 1_314_000], ['tshirt-08', 'white', 'M', 414_000], ['manto-11', 'black', 'M', 1_504_000]
    ]);
    assert.equal(rail.total, 9);
    assert.equal(rail.maxPercent, 20);
  });

  it('links each piece to its product with that colour and size chosen', () => {
    const piece = getLastPieces(products).items.find(p => p.slug === 'shomiz-06')!;
    assert.equal(piece.href, '/product/shomiz-06?color=black&size=L');
    assert.deepEqual(piece.color, { id: 'black', name: 'مشکی', hex: piece.color.hex });
    assert.equal(piece.percent, 20);
    assert.equal(piece.key, 'shomiz-06:black:L');
  });

  it('judges each variant on its own and skips one whose colour the product no longer has', () => {
    const stale = { ...product('stale', { 'cream-M': 1 }), variants: [...product('stale', { 'cream-M': 1 }).variants,
      { colorId: 'gone', size: 'M', stock: 1 }] };
    const rail = getLastPieces([product('two', { 'cream-M': 1, 'black-L': 1, 'black-M': 3 }), stale]);
    assert.deepEqual(rail.items.map(p => p.key), ['two:cream:M', 'two:black:L', 'stale:cream:M']);
  });

  it('lists a last piece whose own sale is deeper at that sale price, with no last-piece percent', () => {
    const rail = getLastPieces([product('deep', { 'cream-M': 1 }, { price: 437_000, compareAt: 530_000 }, { enabled: true, percent: 10 })]);
    assert.deepEqual(rail.items[0].offer, { price: 437_000, compareAt: 530_000 });
    assert.equal(rail.items[0].percent, 0);
    assert.equal(rail.maxPercent, 0);
  });

  it('caps the items at the limit but counts them all', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      product('p' + i, { 'cream-M': 1 }, { createdAt: new Date(Date.UTC(2026, 8, 1 + i)).toISOString() }));
    const rail = getLastPieces(many, 10);
    assert.equal(rail.items.length, 10);
    assert.equal(rail.total, 12);
    assert.equal(rail.items[0].slug, 'p11');
  });

  it('is empty when no variant is at one unit', () => {
    assert.deepEqual(getLastPieces([product('plenty', { 'cream-M': 3 })]), { items: [], total: 0, maxPercent: 0 });
  });
});
