import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rankProduct } from '@/lib/search';
import { byId, products } from '@/data/products';
import type { Product } from '@/types/store';

const linen = byId('shomiz-01')!; // «شومیز لینن آوید», cotton and viscose
const ranks = (query: string) => products.map(p => rankProduct(p, query)).filter((r): r is number => r !== null);

describe('rankProduct', () => {
  it('ranks an exact name first, then a name prefix, then words anywhere in the name', () => {
    assert.equal(rankProduct(linen, 'شومیز لینن آوید'), 0);
    assert.equal(rankProduct(linen, 'شومیز لینن'), 10);
    assert.equal(rankProduct(linen, 'لینن'), 20);
    assert.equal(rankProduct(linen, 'آوید لینن'), 20, 'word order does not matter');
  });

  it('tolerates Arabic letters, extra spaces and punctuation in the query', () => {
    assert.equal(rankProduct(linen, '  شوميز،   لينن  '), 10);
  });

  it('matches colors, then materials and descriptions, then words typed without their space', () => {
    const cream = products.find(p => p.colors.some(c => c.id === 'cream') && !p.name.includes('کرم'))!;
    assert.equal(rankProduct(cream, 'کرم'), 40);
    assert.equal(rankProduct(byId('tshirt-01')!, 'پنبه'), 65);
    assert.equal(rankProduct(byId('tshirt-09')!, 'آستینکوتاه'), 80);
  });

  it('matches on the category title when the name does not', () => {
    const renamed: Product = { ...linen, name: 'بلوز آوید', description: 'توضیح ساده' };
    assert.equal(rankProduct(renamed, 'شومیز'), 30);
  });

  it('returns null when any word is missing, and for an empty query', () => {
    assert.equal(rankProduct(linen, 'لینن xyz'), null);
    assert.equal(rankProduct(linen, ''), null);
    assert.equal(rankProduct(linen, ' ، '), null);
  });

  it('finds every product of a category by its title, and nothing for gibberish', () => {
    assert.equal(ranks('مانتو').length, 12);
    assert.equal(ranks('qwertyuiop').length, 0);
  });
});
