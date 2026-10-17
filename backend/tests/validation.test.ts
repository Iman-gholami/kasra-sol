import { it } from 'node:test';
import assert from 'node:assert/strict';
import { checkout } from '../src/validation';

const payload = {
  items: [{ productId: 'manto-01', colorId: 'black', size: 'M', quantity: 1 }],
  fields: { name: 'نام و نام خانوادگی', mobile: '09123456789', province: 'تهران',
    city: 'تهران', address: 'خیابان آزادی پلاک ۱۲', postal: '1234567890', notes: '' },
  shipping: 'courier', payment: 'cod', code: ''
};
it('accepts valid checkout payload', () => {
  assert.equal(checkout.safeParse(payload).success, true);
});
it('rejects duplicate product variants and invalid quantities', () => {
  assert.equal(checkout.safeParse({ ...payload, items: [...payload.items, ...payload.items] }).success, false);
  assert.equal(checkout.safeParse({ ...payload, items: [{ ...payload.items[0], quantity: -2 }] }).success, false);
});
it('rejects invalid postal and mobile numbers', () => {
  assert.equal(checkout.safeParse({ ...payload, fields: { ...payload.fields, postal: '123' } }).success, false);
  assert.equal(checkout.safeParse({ ...payload, fields: { ...payload.fields, mobile: '123' } }).success, false);
});
