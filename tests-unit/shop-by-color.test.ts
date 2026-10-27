import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_PREVIEW_LIMIT, colorFamilyId, getShopByColorResults, hasColorFamily,
  variantMatchesColorFamily } from '@/lib/shop-by-color';
import { byId, palette, products } from '@/data/products';
import type { Product } from '@/types/store';

const base = byId('manto-01')!;
function product(id: string, colors: Product['colors'], stock: Record<string, number>, extra: Partial<Product> = {}): Product {
  return { ...base, id, slug: id, colors, sizes: ['M'], featured: false,
    variants: colors.map(color => ({ colorId: color.id, size: 'M', stock: stock[color.id] ?? 1 })), ...extra };
}

describe('color families', () => {
  it('uses the explicit family, or the color itself', () => {
    assert.equal(colorFamilyId({ id: 'navy', name: 'سرمه‌ای', hex: '#223355', familyId: 'blue' }), 'blue');
    assert.equal(colorFamilyId({ id: 'black', name: 'مشکی', hex: '#000000' }), 'black');
  });

  it('matches a variant through its declared color, never by guessing', () => {
    const p = product('fam-01', [{ id: 'navy', name: 'سرمه‌ای', hex: '#223355', familyId: 'blue' }], {});
    assert.equal(variantMatchesColorFamily(p, 'navy', 'blue'), true);
    assert.equal(variantMatchesColorFamily(p, 'navy', 'navy'), false);
    assert.equal(variantMatchesColorFamily(p, 'undeclared', 'blue'), false);
    assert.equal(hasColorFamily(p, 'blue'), true);
    assert.equal(hasColorFamily(p, 'black'), false);
  });

  it('does not count a color that has no variant', () => {
    const p: Product = { ...product('fam-02', [{ id: 'black', name: 'مشکی', hex: '#000000' }], {}),
      colors: [{ id: 'black', name: 'مشکی', hex: '#000000' }, { id: 'white', name: 'سفید', hex: '#ffffff' }] };
    assert.equal(hasColorFamily(p, 'white'), false);
  });
});

describe('getShopByColorResults', () => {
  it('lists every palette color of the demo catalog in palette order, with small previews', () => {
    const results = getShopByColorResults();
    assert.deepEqual(results.map(r => r.color.slug), palette.map(c => c.id));
    for (const result of results) {
      const expected = products.filter(p => hasColorFamily(p, result.color.slug)).length;
      assert.equal(result.count, expected, result.color.slug);
      assert.ok(result.products.length > 0 && result.products.length <= COLOR_PREVIEW_LIMIT);
      for (const preview of result.products) {
        assert.equal(preview.images.length, 1, 'only the card photo goes to the browser');
        assert.ok(!('variants' in preview) && !('description' in preview), 'no stock tables or long text');
      }
    }
  });

  it('previews featured products first, then the newest', () => {
    const catalog = [
      product('old-plain', [palette[0]], {}, { createdAt: '2026-01-01T00:00:00Z' }),
      product('new-plain', [palette[0]], {}, { createdAt: '2026-05-01T00:00:00Z' }),
      product('old-featured', [palette[0]], {}, { createdAt: '2025-01-01T00:00:00Z', featured: true })
    ];
    assert.deepEqual(getShopByColorResults(catalog)[0].products.map(p => p.id), ['old-featured', 'new-plain', 'old-plain']);
  });

  it('leads with products whose card photos differ, so the preview never shows one photo over and over', () => {
    const photo = (image: string) => ({ images: [image] });
    const catalog = [
      product('a', [palette[0]], {}, { ...photo('/one.avif'), createdAt: '2026-05-04T00:00:00Z' }),
      product('b', [palette[0]], {}, { ...photo('/one.avif'), createdAt: '2026-05-03T00:00:00Z' }),
      product('c', [palette[0]], {}, { ...photo('/one.avif'), createdAt: '2026-05-02T00:00:00Z' }),
      product('d', [palette[0]], {}, { ...photo('/two.avif'), createdAt: '2026-05-01T00:00:00Z' }),
      product('e', [palette[0]], {}, { ...photo('/three.avif'), createdAt: '2026-04-01T00:00:00Z' })
    ];
    assert.deepEqual(getShopByColorResults(catalog)[0].products.map(p => p.id), ['a', 'd', 'e', 'b']);
  });

  it('groups shades into their family with the palette name and swatch, counting each product once', () => {
    const shades = [{ id: 'navy', name: 'سرمه‌ای', hex: '#223355', familyId: 'blue' },
      { id: 'sky', name: 'آسمانی', hex: '#88bbff', familyId: 'blue' }];
    const [blue] = getShopByColorResults([product('two-blues', shades, {})]);
    const style = palette.find(c => c.id === 'blue')!;
    assert.deepEqual(blue.color, { slug: 'blue', name: style.name, hex: style.hex, order: palette.indexOf(style) });
    assert.equal(blue.count, 1);
  });

  it('puts colors outside the palette after it, under their own name and swatch', () => {
    const gold = { id: 'gold', name: 'طلایی', hex: '#ccaa33' };
    const results = getShopByColorResults([product('gold-01', [gold, palette[1]], {})]);
    assert.deepEqual(results.map(r => r.color.slug), [palette[1].id, 'gold']);
    assert.equal(results[1].color.name, 'طلایی');
    assert.ok(results[1].color.order >= palette.length);
  });

  it('returns nothing for an empty catalog', () => {
    assert.deepEqual(getShopByColorResults([]), []);
  });
});
