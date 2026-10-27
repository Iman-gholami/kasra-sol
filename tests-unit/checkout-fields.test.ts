import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addressComplete, addressOrder, normalizeMobile, normalizePostal, provinces, sampleFields,
  validate } from '@/components/checkout/fields';
import { completeOrder, emptyFields, loadDraft, saveCode, saveDraft, type DemoOrder,
  type Fields } from '@/components/checkout/checkout-storage';
import { orderAttempt } from '@/lib/order-attempt';
import { orderTotals } from '@/lib/checkout';
import { memoryStorage, setGlobal } from './helpers';

const valid: Fields = { name: 'مریم احمدی', mobile: '09121234567', province: 'تهران', city: 'تهران',
  address: 'خیابان آزادی، کوچه ۵، پلاک ۱۲', postal: '1234567890', notes: '' };

describe('normalizeMobile', () => {
  it('accepts Persian digits, spaces, dashes, parentheses and an Iranian country prefix', () => {
    for (const input of ['09121234567', '۰۹۱۲۱۲۳۴۵۶۷', '0912 123 4567', '0912-123-4567', '(0912) 1234567',
      '+989121234567', '00989121234567', '989121234567', '9121234567'])
      assert.equal(normalizeMobile(input), '09121234567', input);
  });
  it('leaves other numbers recognisably invalid', () => {
    assert.equal(normalizeMobile('12345'), '12345');
    assert.equal(normalizeMobile('+441234567890'), '+441234567890');
  });
});

describe('validate', () => {
  it('accepts a complete address, in the order the form asks for it', () => {
    for (const field of addressOrder) assert.equal(validate(field, valid), undefined, field);
    assert.equal(addressComplete(valid), true);
    assert.deepEqual(addressOrder, ['name', 'mobile', 'province', 'city', 'address', 'postal']);
  });
  it('gives a Persian message for each missing or malformed field', () => {
    const broken: Fields = { name: 'ab', mobile: '0912', province: '', city: 'x', address: 'کوتاه', postal: '123', notes: '' };
    for (const field of addressOrder) assert.match(validate(field, broken) ?? '', /[آ-ی]/, field);
    assert.equal(addressComplete(broken), false);
    assert.equal(validate('notes', broken), undefined, 'notes are optional');
  });
  it('trims before measuring, so spaces cannot satisfy a minimum length', () => {
    assert.ok(validate('name', { ...valid, name: '   ab   ' }));
    assert.ok(validate('address', { ...valid, address: '   کوتاه         ' }));
  });
  it('accepts mobile and postal codes the way people type them', () => {
    assert.equal(validate('mobile', { ...valid, mobile: '+98 912 123 4567' }), undefined);
    assert.equal(validate('postal', { ...valid, postal: '۱۲۳۴۵-۶۷۸۹۰' }), undefined);
    assert.equal(normalizePostal('۱۲۳۴۵ ۶۷۸۹۰'), '1234567890');
  });
  it('ships sample data that passes validation, and offers Tehran for the courier', () => {
    assert.equal(addressComplete(sampleFields), true);
    assert.ok(provinces.includes('تهران'));
    assert.equal(new Set(provinces).size, provinces.length);
  });
});

describe('checkout draft storage', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, writable: true, value: storage });
  });

  it('starts empty with the default methods', () => {
    assert.deepEqual(loadDraft(), { fields: emptyFields, shipping: 'post', payment: 'online', code: '' });
  });

  it('saves and restores a draft, and keeps the code when only the code changes', () => {
    saveDraft({ fields: valid, shipping: 'courier', payment: 'cod', code: '' });
    saveCode('KASRA10');
    assert.deepEqual(loadDraft(), { fields: valid, shipping: 'courier', payment: 'cod', code: 'KASRA10' });
  });

  it('ignores tampered or outdated values instead of crashing', () => {
    storage.setItem('kasra-checkout-draft-v1', JSON.stringify({
      fields: { name: 42, mobile: '0912', extra: 'x' }, shipping: 'teleport', payment: 'crypto', code: ['x'] }));
    assert.deepEqual(loadDraft(), { fields: { ...emptyFields, mobile: '0912' }, shipping: 'post', payment: 'online', code: '' });
    storage.setItem('kasra-checkout-draft-v1', '{not json');
    assert.deepEqual(loadDraft().fields, emptyFields);
  });

  it('keeps working when storage is blocked', t => {
    setGlobal(t, 'sessionStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); } });
    assert.doesNotThrow(() => saveDraft({ fields: valid, shipping: 'post', payment: 'online', code: '' }));
    assert.equal(loadDraft().shipping, 'post');
  });

  it('on completion stores the receipt, forgets the draft and ends the retry attempt', async () => {
    saveDraft({ fields: valid, shipping: 'post', payment: 'online', code: '' });
    const attempt = await orderAttempt('cart');
    const order: DemoOrder = { id: 'KS-123456', items: [], fields: valid, shipping: 'post', payment: 'online', code: '',
      totals: orderTotals([], 'post', '') };
    completeOrder(order);
    assert.deepEqual(JSON.parse(storage.getItem('kasra-demo-order-v1')!), order);
    assert.equal(storage.getItem('kasra-checkout-draft-v1'), null);
    assert.notEqual((await orderAttempt('cart')).key, attempt.key, 'a new purchase gets a new idempotency key');
  });
});
