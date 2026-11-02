import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLastPieces } from '@/lib/last-pieces';
import { byId, products } from '@/data/products';
import type { Product, ProductVariant } from '@/types/store';

const base = byId('shomiz-02')!;
const cream = { id: 'cream', name: 'کرم', hex: '#e8d8c3' }, black = { id: 'black', name: 'مشکی', hex: '#222222' };
/** A product in cream and black; `stock` lists the units per variant. Later dates are newer. */
function product(id: string, stock: Partial<Record<'cream-M' | 'cream-L' | 'black-M' | 'black-L', number>>,
  extra: Partial<Product> = {}): Product {
  const variants: ProductVariant[] = (['cream-M', 'cream-L', 'black-M', 'black-L'] as const)
    .map(key => ({ colorId: key.split('-')[0], size: key.split('-')[1], stock: stock[key] ?? 0 }));
  return { ...base, id, slug: id, name: 'مدل ' + id, price: 900_000, compareAt: undefined, colors: [cream, black],
    sizes: ['M', 'L'], images: ['/' + id + '-a.avif', '/' + id + '-b.avif'], variants,
    createdAt: '2026-09-01T00:00:00.000Z', ...extra };
}

describe('getLastPieces', () => {
  it('keeps only models with exactly one unit left across every colour and size', () => {
    const rail = getLastPieces([
      product('one-left', { 'black-L': 1 }),
      product('one-in-two-sizes', { 'cream-M': 1, 'cream-L': 1 }),
      product('two-of-one', { 'black-M': 2 }),
      product('sold-out', {}),
      product('plenty', { 'cream-M': 4, 'black-L': 6 })
    ]);
    assert.deepEqual(rail?.items.map(item => item.id), ['one-left']);
  });

  it('names the piece that is left: its colour and its size', () => {
    const rail = getLastPieces([product('a', { 'black-L': 1 })]);
    assert.deepEqual(rail?.items[0], { id: 'a', slug: 'a', name: 'مدل a', price: 900_000, compareAt: undefined,
      image: '/a-a.avif', color: { name: 'مشکی', hex: '#222222' }, size: 'L' });
  });

  it('keeps a discount when the last piece has one', () => {
    const rail = getLastPieces([product('a', { 'cream-M': 1 }, { price: 800_000, compareAt: 1_000_000 })]);
    assert.equal(rail?.items[0].compareAt, 1_000_000);
  });

  it('lists the newest first, shows at most ten and counts them all for «see all»', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      product('p' + i, { 'cream-M': 1 }, { createdAt: new Date(Date.UTC(2026, 8, 1 + i)).toISOString() }));
    const rail = getLastPieces(many);
    assert.deepEqual(rail?.items.map(item => item.id), ['p11', 'p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3', 'p2']);
    assert.equal(rail?.total, 12);
  });

  it('is left out when no model is down to its last piece', () => {
    assert.equal(getLastPieces([]), null);
    assert.equal(getLastPieces([product('plenty', { 'cream-M': 3 }), product('sold-out', {})]), null);
  });

  it('finds the demo catalog\'s five last pieces, newest first', () => {
    const rail = getLastPieces(products);
    assert.deepEqual(rail?.items.map(item => item.slug), ['shomiz-04', 'shomiz-07', 'manto-06', 'tshirt-08', 'manto-11']);
    assert.ok(rail?.items.every(item => item.size === 'M'));
  });
});
