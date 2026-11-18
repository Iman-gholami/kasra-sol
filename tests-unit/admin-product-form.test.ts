import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLOR_PRESETS, discountPercent, latinSlug, orderSizes, SIZE_GROUPS, suggestedAddress, SUGGESTIONS, uniqueIdent
} from '@/components/admin/product-form';
import { groupDigits } from '@/components/admin/ui';
import { palette } from '@/data/facets';

const IDENT = /^[a-z0-9][a-z0-9-]{1,78}$/;

describe('product address from a Persian name', () => {
  it('writes Persian names in Latin letters the way the catalog already does', () => {
    assert.equal(latinSlug('مانتو لینن'), 'manto-linn');
    assert.equal(latinSlug('شومیز'), 'shomiz');
    assert.equal(latinSlug('شومیز یقه‌دار مهتاب'), 'shomiz-yghe-dar-mhtab');
    assert.equal(latinSlug('تیشرت اورسایز ۲۰۲۶'), 'tishrt-aorsaiz-2026');
    assert.equal(latinSlug('Linen Shirt – Blue!'), 'linen-shirt-blue');
    assert.equal(latinSlug('  ،،  '), '');
  });

  it('always gives an identifier the API accepts, even for names without letters', () => {
    for (const name of ['مانتو کتان سارا', 'شومیز (کپی)', 'آ', '', '؟؟', 'ك ي ى ة ؤ ئ', 'x'.repeat(300)]) {
      const address = suggestedAddress(name, 'manto');
      assert.match(address, IDENT, name);
    }
    assert.match(suggestedAddress('؟', 'shomiz'), /^shomiz-\d{5}$/);
    assert.ok(latinSlug('ا'.repeat(200)).length <= 79);
  });

  it('numbers a taken identifier instead of reusing it', () => {
    assert.equal(uniqueIdent('navy', [], 'color'), 'navy');
    assert.equal(uniqueIdent('navy', ['navy'], 'color'), 'navy-2');
    assert.equal(uniqueIdent('navy', ['navy', 'navy-2'], 'color'), 'navy-3');
    assert.equal(uniqueIdent('', ['color'], 'color'), 'color-2');
    assert.match(uniqueIdent('a'.repeat(79), ['a'.repeat(79)], 'color'), IDENT);
  });
});

describe('colour and size presets', () => {
  it('offers valid, distinct colours that group into the storefront colour families', () => {
    const ids = COLOR_PRESETS.map(color => color.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(COLOR_PRESETS.map(color => color.name)).size, ids.length);
    const families = palette.map(color => color.id);
    for (const color of COLOR_PRESETS) {
      assert.match(color.id, IDENT, color.name);
      assert.match(color.hex, /^#[0-9a-f]{6}$/i, color.name);
      if (color.familyId) assert.ok(families.includes(color.familyId), color.name + ' → ' + color.familyId);
    }
    for (const family of families) assert.ok(ids.includes(family), 'the storefront family ' + family + ' can be picked');
  });

  it('keeps sizes in their usual order, others after them, without repeats', () => {
    assert.deepEqual(orderSizes(['XL', 'M', 'S', 'M']), ['S', 'M', 'XL']);
    assert.deepEqual(orderSizes(['۲ سال', '40', 'فری‌سایز', 'S']), ['S', '40', 'فری‌سایز', '۲ سال']);
    assert.deepEqual(orderSizes([' L ', '']), ['L']);
    const all = SIZE_GROUPS.flatMap(group => group.sizes);
    assert.equal(new Set(all).size, all.length);
    for (const size of all) assert.ok(size.length <= 20);
  });

  it('suggests text that fits the API limits', () => {
    for (const [field, items] of Object.entries(SUGGESTIONS))
      for (const text of items) assert.ok(text.length >= 1 && text.length <= (field === 'care' ? 1000 : 200), text);
  });
});

describe('prices', () => {
  it('shows the discount percent only when the «before» price is higher', () => {
    assert.equal(discountPercent(850_000, 1_000_000), 15);
    assert.equal(discountPercent(1_000_000, 1_000_000), null);
    assert.equal(discountPercent(1_000_000, null), null);
    assert.equal(discountPercent(0, 1_000_000), null);
  });

  it('groups amounts by thousands for reading', () => {
    assert.equal(groupDigits('1250000'), '1,250,000');
    assert.equal(groupDigits('950'), '950');
    assert.equal(groupDigits('0012000'), '12,000');
    assert.equal(groupDigits(''), '');
    assert.equal(groupDigits('0'), '0');
  });
});
