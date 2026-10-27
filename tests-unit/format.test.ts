import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { discountPercent, editorialNumber, formatNumber, formatPercent, normalizePersian, toLatinDigits,
  toman, toPersianDigits } from '@/lib/format';

describe('digits', () => {
  it('turns Persian and Arabic-Indic digits into ASCII and leaves everything else alone', () => {
    assert.equal(toLatinDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
    assert.equal(toLatinDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
    assert.equal(toLatinDigits('کد ۱۲-ab٣'), 'کد 12-ab3');
    assert.equal(toLatinDigits(''), '');
  });
  it('writes ASCII digits in Persian without grouping (phones, postal and tracking codes)', () => {
    assert.equal(toPersianDigits('09121234567'), '۰۹۱۲۱۲۳۴۵۶۷');
    assert.equal(toPersianDigits('KS-1234'), 'KS-۱۲۳۴');
    assert.equal(toLatinDigits(toPersianDigits('0123456789')), '0123456789');
  });
  it('pads editorial numbers to two Persian digits', () => {
    assert.equal(editorialNumber(3), '۰۳');
    assert.equal(editorialNumber(12), '۱۲');
  });
});

describe('normalizePersian', () => {
  it('unifies Arabic letters, removes diacritics, tatweel and punctuation, and collapses spaces', () => {
    assert.equal(normalizePersian('  شوميز  كتان‌ آبی، «جدید»!  '), 'شومیز کتان آبی جدید');
    assert.equal(normalizePersian('مانـــتو'), 'مانتو');
    assert.equal(normalizePersian('سَلام'), 'سلام');
    assert.equal(normalizePersian('ABC ۱۲۳ ١٢٣'), 'abc 123 123');
  });
  it('treats the zero-width non-joiner as a word break', () => {
    assert.equal(normalizePersian('آستین‌کوتاه'), 'آستین کوتاه');
  });
  it('returns an empty string for punctuation or whitespace only', () => {
    assert.equal(normalizePersian(' ،؛!؟ '), '');
  });
});

describe('money and percentages', () => {
  it('formats amounts with Persian digits and the Persian thousands separator', () => {
    assert.equal(formatNumber(1234567), '۱٬۲۳۴٬۵۶۷');
    assert.equal(toman(85000), '۸۵٬۰۰۰ تومان');
    assert.equal(formatNumber(0), '۰');
  });
  it('rounds percentages to whole numbers', () => {
    assert.equal(formatPercent(12.6), '۱۳٪');
  });
  it('reports a discount only when the original price is higher', () => {
    assert.equal(discountPercent(80, 100), 20);
    assert.equal(discountPercent(589000, 710000), 17);
    assert.equal(discountPercent(100, 100), 0);
    assert.equal(discountPercent(100, 80), 0);
    assert.equal(discountPercent(100), 0);
  });
});
