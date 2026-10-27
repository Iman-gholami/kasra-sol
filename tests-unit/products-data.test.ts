import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { byId, bySlug, categories, demoPhotos, getCategory, getVariant, palette, products, standardSizes,
  studioPhotos } from '@/data/products';
import { weekLooks } from '@/data/week-looks';
import { isDemoPhoto } from '@/lib/demo-photos';

// The cart, the catalog lookup API and the backend all accept only ids of this shape.
const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{1,78}$/;
const publicFile = (path: string) => existsSync(join(process.cwd(), 'public', path));
/** An AVIF's pixel size, from its image spatial extents ('ispe') property. */
function avifSize(path: string) {
  const bytes = readFileSync(join(process.cwd(), 'public', path));
  const at = bytes.indexOf('ispe');
  assert.ok(at > 0, path + ' has no ispe box');
  return { width: bytes.readUInt32BE(at + 8), height: bytes.readUInt32BE(at + 12) };
}
const studioPhotoList = [studioPhotos.cover, studioPhotos.closing, ...Object.values(studioPhotos.portraits), ...Object.values(demoPhotos).flat()];

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
    for (const image of studioPhotoList) assert.ok(publicFile(image), image);
  });

  it('shows photos large enough for their slots, never the blurry 94px mockup crops', () => {
    for (const image of [studioPhotos.cover, studioPhotos.closing, ...Object.values(demoPhotos).flat()]) {
      const { width, height } = avifSize(image);
      assert.ok(width >= 450 && height >= 590, image + ' is ' + width + '×' + height);
    }
    for (const image of Object.values(studioPhotos.portraits)) assert.ok(avifSize(image).width >= 200, image);
  });

  it('still serves the photo URLs that catalogs seeded from 25 October store, now as studio photos', () => {
    // The seed never rewrites existing products, so these paths stay in such databases.
    for (const crop of ['shomiz-blue', 'shomiz-cream', 'manto-cream', 'manto-pink', 'tshirt-blue']) {
      const { width, height } = avifSize('/images/brand-preview/' + crop + '.avif');
      assert.ok(width >= 450 && height >= 590, crop + ' is ' + width + '×' + height);
    }
  });

  it('features products from every category and leaves some sold-out sizes to exercise the UI', () => {
    for (const category of categories)
      assert.ok(products.some(p => p.category === category.slug && p.featured), category.slug);
    assert.ok(products.some(p => p.variants.some(v => v.stock === 0)));
  });
});

describe('demo photos', () => {
  it('recognizes every sample photo, so product pages always say they are not pictures of the real item', () => {
    for (const product of products) for (const image of product.images) assert.ok(isDemoPhoto(image), product.id + ' ' + image);
    for (const image of studioPhotoList) assert.ok(isDemoPhoto(image), image);
    for (const look of weekLooks) assert.ok(isDemoPhoto(look.image), look.image);
  });
  it('does not label uploaded product photos as samples', () => {
    assert.equal(isDemoPhoto('/api/media/0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e.webp'), false);
    assert.equal(isDemoPhoto('/images/catalog/manto-01.jpg'), false);
  });
});

describe('week of looks', () => {
  it('dresses Saturday to Thursday once each, in order', () => {
    assert.deepEqual(weekLooks.map(look => look.day), ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه']);
    assert.equal(new Set(weekLooks.map(look => look.image)).size, weekLooks.length);
  });
  it('links every look to products of its category and color, with a full-size photo', () => {
    for (const look of weekLooks) {
      assert.ok(categories.some(category => category.slug === look.category), look.day);
      assert.ok(palette.some(color => color.id === look.color), look.day);
      assert.ok(products.some(p => p.category === look.category && p.colors.some(c => c.id === look.color)), look.day);
      assert.ok(avifSize(look.image).width >= 450, look.image);
    }
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
