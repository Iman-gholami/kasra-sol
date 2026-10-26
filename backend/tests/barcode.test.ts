import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ean13CheckDigit, isStoreBarcode, storeBarcode } from '../src/admin/barcode';
import { may } from '../src/admin/permissions';

test('EAN-13 check digits match published retail codes', () => {
  assert.equal(ean13CheckDigit('400638133393'), '1');
  assert.equal(ean13CheckDigit('590123412345'), '7');
});
test('store barcodes are 13 digits in the in-store prefix 20 with a valid check digit', () => {
  assert.equal(storeBarcode(1), '2000000000015');
  assert.equal(storeBarcode(1234567), '2000012345678');
  for (const n of [1, 42, 9_999_999_999]) assert.equal(isStoreBarcode(storeBarcode(n)), true);
  assert.throws(() => storeBarcode(0));
  assert.throws(() => storeBarcode(10_000_000_000));
});
test('a mistyped digit, a foreign code or Persian digits are not store barcodes', () => {
  const code = storeBarcode(73);
  const typo = code.slice(0, 5) + String((Number(code[5]) + 1) % 10) + code.slice(6);
  assert.equal(isStoreBarcode(typo), false);
  assert.equal(isStoreBarcode('4006381333931'), false, 'valid EAN-13 outside the in-store range');
  assert.equal(isStoreBarcode('۲۰۰۰۰۰۰۰۰۰۰۱۵'), false, 'the panel converts Persian digits before sending');
  assert.equal(isStoreBarcode(code + '0'), false);
});
test('the shop counter is a default for staff and managers; discounts and receiving goods are not for staff', () => {
  assert.equal(may('staff', [], [], 'sales:pos'), true);
  assert.equal(may('manager', [], [], 'sales:pos'), true);
  assert.equal(may('staff', [], ['sales:pos'], 'sales:pos'), false);
  assert.equal(may('staff', [], [], 'inventory:write'), false);
  assert.equal(may('staff', [], [], 'products:price'), false);
});
