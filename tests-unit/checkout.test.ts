import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyDiscount, cartTotals, DEFAULT_PAYMENT, DEFAULT_SHIPPING, discountCodes, FREE_SHIPPING_THRESHOLD,
  freeShippingProgress, normalizeCode, orderTotals, paymentById, paymentMethods, paymentRestriction, resolveLines,
  shippingById, shippingCost, shippingMethods, shippingRestriction, type ShippingMethodId } from '@/lib/checkout';
import { byId } from '@/data/products';
import type { CartItem } from '@/types/store';

const item = (productId: string, quantity = 1): CartItem => ({ productId, colorId: 'cream', size: 'M', quantity });
// shomiz-01: 589,000 marked down from 710,000. shomiz-02: 632,000 with no markdown.
const lines = resolveLines([item('shomiz-01', 2), item('shomiz-02', 1)]);

describe('shipping and payment methods', () => {
  it('has unique ids and defaults that are allowed together for any address', () => {
    assert.equal(new Set(shippingMethods.map(m => m.id)).size, shippingMethods.length);
    assert.equal(new Set(paymentMethods.map(m => m.id)).size, paymentMethods.length);
    assert.equal(shippingRestriction(shippingById(DEFAULT_SHIPPING), 'فارس', 'شیراز'), undefined);
    assert.equal(paymentRestriction(paymentById(DEFAULT_PAYMENT), DEFAULT_SHIPPING), undefined);
  });
  it('falls back to the first method for an unknown id', () => {
    assert.equal(shippingById('unknown' as ShippingMethodId).id, shippingMethods[0].id);
    assert.equal(paymentById('unknown' as 'online').id, paymentMethods[0].id);
  });
  it('limits the same-day courier to the city of Tehran', () => {
    const courier = shippingById('courier');
    assert.equal(shippingRestriction(courier, 'تهران', 'تهران'), undefined);
    assert.equal(shippingRestriction(courier, 'تهران', '  تهران '), undefined);
    assert.match(shippingRestriction(courier, 'تهران', 'کرج') ?? '', /تهران/);
    assert.match(shippingRestriction(courier, 'اصفهان', 'تهران') ?? '', /تهران/);
    for (const id of ['post', 'express'] as const)
      assert.equal(shippingRestriction(shippingById(id), 'گیلان', 'رشت'), undefined, id);
  });
  it('allows cash on delivery only with the courier', () => {
    const cod = paymentById('cod');
    assert.equal(paymentRestriction(cod, 'courier'), undefined);
    assert.ok(paymentRestriction(cod, 'post'));
    assert.ok(paymentRestriction(cod, 'express'));
    for (const shipping of ['post', 'express', 'courier'] as const)
      assert.equal(paymentRestriction(paymentById('online'), shipping), undefined, shipping);
  });
});

describe('shipping cost and the free-shipping meter', () => {
  it('makes post free from the threshold and keeps the other methods at their price', () => {
    assert.equal(shippingCost(shippingById('post'), FREE_SHIPPING_THRESHOLD - 1), 85_000);
    assert.equal(shippingCost(shippingById('post'), FREE_SHIPPING_THRESHOLD), 0);
    assert.equal(shippingCost(shippingById('express'), FREE_SHIPPING_THRESHOLD * 2), 145_000);
    assert.equal(shippingCost(shippingById('courier'), FREE_SHIPPING_THRESHOLD * 2), 120_000);
  });
  it('reports the remaining amount and a ratio capped at one', () => {
    assert.deepEqual(freeShippingProgress(0), { remaining: FREE_SHIPPING_THRESHOLD, reached: false, ratio: 0 });
    assert.deepEqual(freeShippingProgress(1_000_000), { remaining: 1_500_000, reached: false, ratio: 0.4 });
    assert.deepEqual(freeShippingProgress(FREE_SHIPPING_THRESHOLD), { remaining: 0, reached: true, ratio: 1 });
    assert.deepEqual(freeShippingProgress(9_000_000), { remaining: 0, reached: true, ratio: 1 });
  });
});

describe('cart lines and totals', () => {
  it('drops cart entries whose product no longer exists', () => {
    const resolved = resolveLines([item('shomiz-01'), item('gone-99')]);
    assert.deepEqual(resolved.map(line => line.product.id), ['shomiz-01']);
    assert.equal(resolveLines([item('x-01')], () => undefined).length, 0);
  });
  it('accepts a custom product lookup (live catalog)', () => {
    const product = { ...byId('manto-01')!, id: 'live-01', price: 1000 };
    assert.equal(resolveLines([item('live-01')], id => id === 'live-01' ? product : undefined)[0].product.price, 1000);
  });
  it('adds units, subtotal and markdown savings', () => {
    assert.equal(byId('shomiz-01')!.compareAt, 710_000);
    assert.equal(byId('shomiz-02')!.compareAt, undefined);
    assert.deepEqual(cartTotals(lines), { units: 3, subtotal: 1_810_000, original: 2_052_000, savings: 242_000 });
    assert.deepEqual(cartTotals([]), { units: 0, subtotal: 0, original: 0, savings: 0 });
  });
});

describe('discount codes', () => {
  it('normalizes case, spaces and Persian or Arabic digits', () => {
    assert.equal(normalizeCode(' kasra ۱۰ '), 'KASRA10');
    assert.equal(normalizeCode('Kasra١٠'), 'KASRA10');
  });
  it('asks for a code when the field is empty and rejects unknown codes', () => {
    assert.deepEqual(applyDiscount('   ', 1_000_000), { ok: false, message: 'کد تخفیف را وارد کن.' });
    const unknown = applyDiscount('NOPE', 1_000_000);
    assert.equal(unknown.ok, false);
  });
  it('takes 10% off with KASRA10, capped at 300,000', () => {
    assert.deepEqual(applyDiscount('kasra ۱۰', 1_000_000),
      { ok: true, code: 'KASRA10', label: discountCodes[0].label, amount: 100_000 });
    const capped = applyDiscount('KASRA10', 5_000_000);
    assert.ok(capped.ok && capped.amount === 300_000);
  });
  it('requires the minimum subtotal for WELCOME and says how much is missing', () => {
    const short = applyDiscount('welcome', 1_000_000);
    assert.equal(short.ok, false);
    assert.ok(!short.ok && short.message.includes('۵۰۰٬۰۰۰'), 'names the missing 500,000');
    const enough = applyDiscount('WELCOME', 1_500_000);
    assert.ok(enough.ok && enough.amount === 150_000);
  });
  it('never discounts more than the subtotal', () => {
    for (const { code } of discountCodes) {
      for (const subtotal of [0, 1, 99_999, 1_500_000, 10_000_000]) {
        const result = applyDiscount(code, subtotal);
        if (result.ok) assert.ok(result.amount >= 0 && result.amount <= subtotal, code + ' at ' + subtotal);
      }
    }
  });
});

describe('order totals', () => {
  it('combines subtotal, discount and shipping (free shipping is judged before the discount)', () => {
    assert.deepEqual(orderTotals(lines, 'post', 'KASRA10'), {
      units: 3, subtotal: 1_810_000, original: 2_052_000, savings: 242_000,
      discount: 181_000, shipping: 85_000, total: 1_714_000
    });
  });
  it('ignores an invalid or empty code instead of failing', () => {
    assert.equal(orderTotals(lines, 'express', 'BROKEN').discount, 0);
    assert.equal(orderTotals(lines, 'express', '').total, 1_810_000 + 145_000);
  });
  it('still charges post shipping below the threshold when the cart is empty', () => {
    assert.equal(orderTotals([], 'post', '').total, 85_000);
  });
});
