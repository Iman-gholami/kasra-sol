import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, DomainError } from '../src/pricing';

describe('server-side price rules', () => {
  it('rejects integer overflow in either subtotal or total before writing an order', () => {
    const invalid = (lines: { price: number; quantity: number }[]) =>
      calculate(lines, 'courier', 'cod', '', 'تهران', 'تهران');
    assert.throws(() => invalid([{ price: 1_000_000_000, quantity: 3 }]),
      (error: unknown) => error instanceof DomainError && error.status === 422);
    assert.throws(() => invalid([{ price: 2_147_483_647, quantity: 1 }]), DomainError);
    assert.equal(invalid([{ price: 2_147_483_647 - 120_000, quantity: 1 }]).total, 2_147_483_647);
  });
  it('calculates discounts and shipping from authoritative item prices', () => {
    const totals = calculate([{ price: 1_000_000, quantity: 2 }], 'post', 'online', 'KASRA10', 'فارس','شیراز');
    assert.deepEqual(totals, { subtotal: 2_000_000, discount: 200_000, shipping: 85_000, total: 1_885_000 });
  });
  it('caps coupons at 300,000 and grants free post shipping', () => {
    const totals = calculate([{ price: 4_000_000, quantity: 1 }], 'post', 'online', 'KASRA10', 'فارس','شیراز');
    assert.equal(totals.discount, 300_000);
    assert.equal(totals.shipping, 0);
    assert.equal(totals.total, 3_700_000);
  });
  it('rejects invalid discounts and forbidden shipping/payment combinations', () => {
    assert.throws(() => calculate([{ price: 100, quantity: 1 }], 'post','cod','','تهران','تهران'), DomainError);
    assert.throws(() => calculate([{ price: 100, quantity: 1 }], 'courier','online','','فارس','شیراز'), DomainError);
    assert.throws(() => calculate([{ price: 100, quantity: 1 }], 'post','online','UNKNOWN','فارس','شیراز'), DomainError);
  });
  it('allows courier cash-on-delivery in Tehran only', () => {
    const totals = calculate([{ price: 500_000, quantity: 2 }], 'courier','cod','','تهران','تهران');
    assert.equal(totals.total, 1_120_000);
  });
});

describe('courier city', () => {
  it('accepts Tehran written with spaces, punctuation, diacritics or a stray joiner, as the checkout form does', () => {
    for (const city of ['تهران', ' تهران ', 'تهران،', 'تِهران', 'تهران‌'])
      assert.equal(calculate([{ price: 100, quantity: 1 }], 'courier', 'cod', '', 'تهران', city).shipping, 120_000, city);
  });
  it('still refuses other cities and other provinces', () => {
    for (const [province, city] of [['تهران', 'کرج'], ['تهران', 'تهرانپارس'], ['البرز', 'تهران']])
      assert.throws(() => calculate([{ price: 100, quantity: 1 }], 'courier', 'cod', '', province, city), DomainError, city);
  });
});
