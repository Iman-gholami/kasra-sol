import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSaleRail } from '@/lib/sale-rail';
import { byId, products } from '@/data/products';
import type { Product } from '@/types/store';

const base = byId('shomiz-02')!;
/** A product with one variant; `stock` 0 makes it unbuyable. Dates order "newest" (later is newer). */
function product(id: string, price: number, compareAt: number | undefined, extra: Partial<Product> & { stock?: number } = {}): Product {
  const { stock = 3, ...rest } = extra;
  return { ...base, id, slug: id, name: 'مدل ' + id, price, compareAt, images: ['/' + id + '-a.avif', '/' + id + '-b.avif'],
    variants: [{ colorId: base.colors[0].id, size: 'M', stock }], createdAt: '2026-09-01T00:00:00.000Z', ...rest };
}

describe('getSaleRail', () => {
  it('keeps only discounted products that can still be bought', () => {
    const rail = getSaleRail([
      product('on-sale', 800_000, 1_000_000),
      product('full-price', 800_000, undefined),
      product('compare-not-higher', 800_000, 800_000),
      product('sold-out', 700_000, 1_000_000, { stock: 0 }),
      product('also-on-sale', 900_000, 1_000_000)
    ]);
    assert.deepEqual(rail?.items.map(item => item.id), ['on-sale', 'also-on-sale']);
  });

  it('leads with the biggest discount, newest first among equal discounts', () => {
    const rail = getSaleRail([
      product('ten-old', 900_000, 1_000_000, { createdAt: '2026-08-01T00:00:00.000Z' }),
      product('thirty-old', 700_000, 1_000_000, { createdAt: '2026-08-01T00:00:00.000Z' }),
      product('thirty-new', 700_000, 1_000_000, { createdAt: '2026-09-15T00:00:00.000Z' }),
      product('twenty', 800_000, 1_000_000)
    ]);
    assert.deepEqual(rail?.items.map(item => item.id), ['thirty-new', 'thirty-old', 'twenty', 'ten-old']);
    assert.deepEqual(rail?.items.map(item => item.percent), [30, 30, 20, 10]);
    assert.equal(rail?.maxPercent, 30);
  });

  it('shows at most ten but counts every product on sale for «see all»', () => {
    const many = Array.from({ length: 12 }, (_, i) => product('sale-' + i, 900_000 - i * 10_000, 1_000_000));
    const rail = getSaleRail(many);
    assert.equal(rail?.items.length, 10);
    assert.equal(rail?.total, 12);
    // The two smallest discounts (10% and 11%) are the ones left out.
    assert.ok(!rail?.items.some(item => item.id === 'sale-0' || item.id === 'sale-1'));
  });

  it('is hidden when fewer than two products are on sale', () => {
    assert.equal(getSaleRail([]), null);
    assert.equal(getSaleRail([product('only', 800_000, 1_000_000), product('full', 800_000, undefined)]), null);
  });

  it('sends only what a card shows: the first photo, prices and the discount', () => {
    const rail = getSaleRail([product('a', 750_000, 1_000_000), product('b', 900_000, 1_000_000)]);
    assert.deepEqual(rail?.items[0], { id: 'a', slug: 'a', name: 'مدل a', price: 750_000, compareAt: 1_000_000,
      image: '/a-a.avif', percent: 25 });
  });

  it('fills the rail from the demo catalog: its nine discounted models', () => {
    const rail = getSaleRail(products);
    assert.equal(rail?.total, 9);
    assert.equal(rail?.items.length, 9);
    assert.ok(rail?.items.every(item => item.compareAt! > item.price));
  });
});
