import assert from 'node:assert/strict';
import test from 'node:test';
import { allCategories, categories, categoryFamily, isCategorySlug } from '../../src/data/facets';
import { productInput } from '../src/admin/product-schema';

test('all requested top-level categories are present and each slug is unique', () => {
  assert.equal(categories.length, 16);
  assert.equal(new Set(allCategories.map(category => category.slug)).size, allCategories.length);
  for (const category of categories) {
    assert.ok(isCategorySlug(category.slug));
    for (const child of category.children) assert.ok(isCategorySlug(child.slug));
  }
});

test('parent category includes its own items plus every child; leaf selects only itself', () => {
  const pants = categoryFamily('pants');
  assert.ok(pants.includes('pants'));
  assert.ok(pants.includes('bag-pants'));
  assert.ok(pants.includes('bootcut-pants'));
  assert.ok(pants.includes('wide-pants'));
  assert.ok(pants.includes('balloon-pants'));
  assert.deepEqual(categoryFamily('bag-pants'), ['bag-pants']);
});

test('older product category values and routes remain valid', () => {
  for (const slug of ['shomiz', 'manto', 'tshirt'] as const) assert.ok(isCategorySlug(slug));
  assert.ok(categoryFamily('shomiz-vest').includes('shomiz'));
  assert.ok(categoryFamily('tshirt-loungewear').includes('tshirt'));
  assert.deepEqual(categoryFamily('manto'), ['manto']);
});

test('admin category validator accepts listed roots and leaves, rejects arbitrary codes', () => {
  const schema = productInput.shape.category;
  for (const slug of ['womens-clothing', 'sets', 'manto', 'bag-pants', 'shomiz', 'puffer', 'tshirt']) {
    assert.equal(schema.safeParse(slug).success, true, slug);
  }
  assert.equal(schema.safeParse('unknown-category').success, false);
});
