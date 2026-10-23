import { it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SLIDES, homeSlidesInput } from '../src/admin/product-schema';

it('accepts an ordered pick of product ids, including an empty one', () => {
  assert.equal(homeSlidesInput.safeParse({ productIds: ['shomiz-01', 'manto-03'] }).success, true);
  assert.equal(homeSlidesInput.safeParse({ productIds: [] }).success, true);
});
it('rejects duplicates, too many slides, malformed ids and extra fields', () => {
  assert.equal(homeSlidesInput.safeParse({ productIds: ['shomiz-01', 'shomiz-01'] }).success, false);
  const many = Array.from({ length: MAX_SLIDES + 1 }, (_, i) => 'item-' + i);
  assert.equal(homeSlidesInput.safeParse({ productIds: many }).success, false);
  assert.equal(homeSlidesInput.safeParse({ productIds: ['Bad Id'] }).success, false);
  assert.equal(homeSlidesInput.safeParse({ productIds: [], extra: true }).success, false);
});
