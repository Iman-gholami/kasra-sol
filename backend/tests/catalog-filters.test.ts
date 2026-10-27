import { it } from 'node:test';
import assert from 'node:assert/strict';
import './support/fake-db';

const { filters } = await import('../src/catalog');

it('defaults to the featured sort, page one and twelve products', () => {
  assert.deepEqual(filters.parse({}), { sort: 'featured', page: 1, limit: 12 });
});
it('reads numbers from the query string', () => {
  assert.deepEqual(filters.parse({ min: '100', max: '900', page: '3', limit: '48' }),
    { min: 100, max: 900, page: 3, limit: 48, sort: 'featured' });
});
it('rejects unknown categories and sorts, and out-of-range numbers', () => {
  for (const query of [{ category: 'shoes' }, { sort: 'random' }, { min: '-1' }, { max: '1.5' }, { page: '0' },
    { page: '1001' }, { limit: '49' }, { limit: '0' }, { stock: 'yes' }, { sale: '2' }, { q: 'x'.repeat(101) },
    { size: 'x'.repeat(21) }, { color: 'x'.repeat(81) }])
    assert.equal(filters.safeParse(query).success, false, JSON.stringify(query));
});
it('accepts every category and sort the storefront offers', () => {
  for (const category of ['shomiz', 'manto', 'tshirt']) assert.equal(filters.safeParse({ category }).success, true);
  for (const sort of ['newest', 'price-asc', 'price-desc', 'featured']) assert.equal(filters.safeParse({ sort }).success, true);
});
