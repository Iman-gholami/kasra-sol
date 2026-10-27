import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { brandMockupPhotos, byId, bySlug, categories, demoPhotos, getCategory, getVariant, palette, products,
  standardSizes } from '@/data/products';

// The cart, the catalog lookup API and the backend all accept only ids of this shape.
const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{1,78}$/;
const publicFile = (path: string) => existsSync(join(process.cwd(), 'public', path));

describe('facets', () => {
  it('has unique category slugs and palette ids with valid hex colors', () => {
    assert.deepEqual(categories.map(c => c.slug).sort(), ['manto', 'shomiz', 'tshirt']);
    assert.equal(new Set(palette.map(c => c.id)).size, palette.length);
    for (const color of palette) assert.match(color.hex, /^#[0-9a-f]{6}$/i, color.id);
    for (const category of categories) assert.ok(category.title && category.description, category.slug);
  });
});

describe('demo catalog', () => {
  it('has 12 products in each category with unique, URL-safe ids and slugs', () => {
    assert.equal(products.length, 36);
    for (const category of categories)
      assert.equal(products.filter(p => p.category === category.slug).length, 12, category.slug);
    assert.equal(new Set(products.map(p => p.id)).size, products.length);
    assert.equal(new Set(products.map(p => p.slug)).size, products.length);
    for (const product of products) {
      assert.match(product.id, PRODUCT_ID);
      assert.match(product.slug, PRODUCT_ID);
    }
  });

  it('has exactly one variant for every declared color and size, with whole non-negative stock', () => {
    for (const product of products) {
      const colorIds = product.colors.map(c => c.id);
      assert.equal(new Set(colorIds).size, colorIds.length, product.id + ' repeats a color');
      assert.deepEqual([...product.sizes], [...standardSizes]);
      assert.equal(product.variants.length, colorIds.length * product.sizes.length, product.id);
      const keys = new Set(product.variants.map(v => v.colorId + '/' + v.size));
      assert.equal(keys.size, product.variants.length, product.id + ' repeats a variant');
      for (const variant of product.variants) {
        assert.ok(colorIds.includes(variant.colorId), product.id + ' variant color ' + variant.colorId);
        assert.ok(product.sizes.includes(variant.size), product.id + ' variant size ' + variant.size);
        assert.ok(Number.isInteger(variant.stock) && variant.stock >= 0, product.id);
      }
      assert.ok(product.variants.some(v => v.stock > 0), product.id + ' is entirely sold out');
    }
  });

  it('uses palette colors and positive whole prices, with markdowns only above the price', () => {
    const paletteIds = new Set(palette.map(c => c.id));
    for (const product of products) {
      for (const color of product.colors) assert.ok(paletteIds.has(color.id), product.id + ' ' + color.id);
      assert.ok(Number.isSafeInteger(product.price) && product.price > 0, product.id);
      if (product.compareAt !== undefined) assert.ok(product.compareAt > product.price, product.id);
    }
    assert.ok(products.some(p => p.compareAt), 'some products are on sale');
    assert.ok(products.some(p => !p.compareAt), 'some products are not on sale');
  });

  it('has the content every product page needs, a valid creation date and existing photos', () => {
    for (const product of products) {
      for (const key of ['name', 'description', 'material', 'fit', 'care'] as const)
        assert.ok(product[key].trim().length > 1, product.id + ' ' + key);
      assert.ok(!Number.isNaN(Date.parse(product.createdAt)), product.id);
      assert.ok(product.images.length > 0, product.id + ' has no photo');
      for (const image of product.images) assert.ok(publicFile(image), product.id + ' ' + image);
    }
    for (const image of [...Object.values(brandMockupPhotos), ...Object.values(demoPhotos).flat()])
      assert.ok(publicFile(image), image);
  });

  it('features products from every category and leaves some sold-out sizes to exercise the UI', () => {
    for (const category of categories)
      assert.ok(products.some(p => p.category === category.slug && p.featured), category.slug);
    assert.ok(products.some(p => p.variants.some(v => v.stock === 0)));
  });
});

describe('lookups', () => {
  it('finds products by slug and id, and categories by slug', () => {
    assert.equal(bySlug('manto-01')?.id, 'manto-01');
    assert.equal(byId('tshirt-12')?.category, 'tshirt');
    assert.equal(bySlug('missing'), undefined);
    assert.equal(byId(''), undefined);
    assert.equal(getCategory('shomiz')?.title, 'شومیز');
    assert.equal(getCategory('shoes'), undefined);
  });
  it('finds a variant by color and size', () => {
    const product = byId('shomiz-01')!;
    const color = product.colors[0].id;
    assert.deepEqual(getVariant(product, color, 'M'), product.variants.find(v => v.colorId === color && v.size === 'M'));
    assert.equal(getVariant(product, color, 'XXL'), undefined);
    assert.equal(getVariant(product, 'not-a-color', 'M'), undefined);
  });
});
