import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lastPieceDeal, offerFor, variantOffer, withLastPieceOffers, type LastPieceSetting } from '@/lib/last-piece-discount';
import type { ProductVariant } from '@/types/store';

const ON20: LastPieceSetting = { enabled: true, percent: 20 };
const ON10: LastPieceSetting = { enabled: true, percent: 10 };
const OFF: LastPieceSetting = { enabled: false, percent: 20 };
type Key = 'cream-M' | 'cream-L' | 'black-M' | 'black-L';
/** A product at 900,000 in cream and black, sizes M and L; `stock` lists the units per variant (missing = 0). */
function product(stock: Partial<Record<Key, number>>, extra: { price?: number; compareAt?: number } = {}) {
  const variants: ProductVariant[] = (['cream-M', 'cream-L', 'black-M', 'black-L'] as const)
    .map(key => ({ colorId: key.split('-')[0], size: key.split('-')[1], stock: stock[key] ?? 0 }));
  return { price: 900_000, compareAt: undefined as number | undefined, variants, ...extra };
}
const restock = <T extends { variants: ProductVariant[] }>(p: T, colorId: string, size: string, stock: number): T =>
  ({ ...p, variants: p.variants.map(v => v.colorId === colorId && v.size === size ? { ...v, stock } : v) });

describe('variantOffer', () => {
  it('discounts a variant at exactly one unit, rounded to the nearest 1,000 toman', () => {
    assert.deepEqual(variantOffer({ price: 718_000 }, 1, ON20), { price: 574_000, compareAt: 718_000 });
  });
  it('leaves two units or more, and none, at the product price', () => {
    assert.deepEqual(variantOffer({ price: 718_000 }, 2, ON20), { price: 718_000 });
    assert.deepEqual(variantOffer({ price: 718_000 }, 5, ON20), { price: 718_000 });
    assert.deepEqual(variantOffer({ price: 718_000 }, 0, ON20), { price: 718_000 });
  });
  it('does nothing while the setting is off', () => {
    assert.deepEqual(variantOffer({ price: 718_000 }, 1, OFF), { price: 718_000 });
  });
  it('takes the percent off the original price when the product is on sale, if that is cheaper', () => {
    assert.deepEqual(variantOffer({ price: 437_000, compareAt: 530_000 }, 1, ON20), { price: 424_000, compareAt: 530_000 });
  });
  it('keeps a deeper product sale: the two discounts never stack', () => {
    assert.deepEqual(variantOffer({ price: 437_000, compareAt: 530_000 }, 1, ON10), { price: 437_000, compareAt: 530_000 });
  });
  it('changes nothing when rounding would not lower the price', () => {
    assert.deepEqual(variantOffer({ price: 1_000 }, 1, { enabled: true, percent: 5 }), { price: 1_000 });
  });
});

describe('withLastPieceOffers and offerFor', () => {
  it('gives the only variant left its discounted price', () => {
    const p = withLastPieceOffers(product({ 'cream-M': 1 }), ON20);
    assert.deepEqual(offerFor(p, 'cream', 'M'), { price: 720_000, compareAt: 900_000 });
  });
  it('discounts one size of many and leaves the others at the product price', () => {
    const p = withLastPieceOffers(product({ 'cream-M': 1, 'cream-L': 5 }), ON20);
    assert.equal(offerFor(p, 'cream', 'M').price, 720_000);
    assert.deepEqual(offerFor(p, 'cream', 'L'), { price: 900_000 });
  });
  it('judges each combination on its own: two at one unit (total 2) are both discounted, the same size in another colour is not', () => {
    const p = withLastPieceOffers(product({ 'cream-M': 1, 'black-L': 1, 'black-M': 3 }), ON20);
    assert.equal(offerFor(p, 'cream', 'M').price, 720_000);
    assert.equal(offerFor(p, 'black', 'L').price, 720_000);
    assert.equal(offerFor(p, 'black', 'M').price, 900_000);
  });
  it('falls back to the product price for an unknown colour or size', () => {
    const p = withLastPieceOffers(product({ 'cream-M': 1 }), ON20);
    assert.deepEqual(offerFor(p, 'nope', 'XXL'), { price: 900_000 });
  });
  it('drops the discount when the variant is restocked or sold out', () => {
    const p = withLastPieceOffers(product({ 'cream-M': 1, 'black-M': 4 }), ON20);
    assert.equal(offerFor(withLastPieceOffers(restock(p, 'cream', 'M', 3), ON20), 'cream', 'M').price, 900_000);
    assert.equal(offerFor(withLastPieceOffers(restock(p, 'cream', 'M', 0), ON20), 'cream', 'M').price, 900_000);
  });
  it('removes every variant offer once the setting is off', () => {
    const p = withLastPieceOffers(product({ 'cream-M': 1 }), ON20);
    const off = withLastPieceOffers(p, OFF);
    assert.deepEqual(offerFor(off, 'cream', 'M'), { price: 900_000 });
    assert.ok(off.variants.every(v => v.price === undefined && v.compareAt === undefined));
  });
  it('does not change the product it is given', () => {
    const p = product({ 'cream-M': 1 });
    withLastPieceOffers(p, ON20);
    assert.ok(p.variants.every(v => v.price === undefined));
  });
});

describe('lastPieceDeal', () => {
  it('summarises some combinations at 20% off', () => {
    const p = withLastPieceOffers(product({ 'cream-M': 1, 'black-L': 1, 'black-M': 3 }), ON20);
    assert.deepEqual(lastPieceDeal(p), { percent: 20, everyVariant: false, offer: { price: 720_000, compareAt: 900_000 } });
  });
  it('says every variant when the only ones left are last pieces', () => {
    assert.equal(lastPieceDeal(withLastPieceOffers(product({ 'cream-M': 1 }), ON20))?.everyVariant, true);
  });
  it('is null with two units, when sold out, and while the setting is off', () => {
    assert.equal(lastPieceDeal(withLastPieceOffers(product({ 'cream-M': 2 }), ON20)), null);
    assert.equal(lastPieceDeal(withLastPieceOffers(product({}), ON20)), null);
    assert.equal(lastPieceDeal(withLastPieceOffers(product({ 'cream-M': 1 }), OFF)), null);
  });
  it('is null for a last piece whose own sale is deeper', () => {
    assert.equal(lastPieceDeal(withLastPieceOffers(product({ 'cream-M': 1 }, { price: 437_000, compareAt: 530_000 }), ON10)), null);
  });
  it('measures the discount from the struck price when the product is already on sale', () => {
    const deal = lastPieceDeal(withLastPieceOffers(product({ 'cream-M': 1, 'cream-L': 3 }, { price: 437_000, compareAt: 530_000 }), ON20));
    assert.deepEqual(deal, { percent: 20, everyVariant: false, offer: { price: 424_000, compareAt: 530_000 } });
  });
});
