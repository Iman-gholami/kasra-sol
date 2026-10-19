import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, csvDigits, ordersCsv, persianDateTime, type ExportRow } from '../src/admin/order-export';

test('customer text can never run as a spreadsheet formula', () => {
  for (const evil of ['=HYPERLINK("http://x","y")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1'])
    assert.ok(csvCell(evil).replace(/^"/, '').startsWith("'"), evil);
  assert.equal(csvCell('خیابان آزادی، پلاک ۲'), 'خیابان آزادی، پلاک ۲');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"\nnext'), '"say ""hi""\nnext"');
  assert.equal(csvCell(-5), '-5', 'numbers we write ourselves stay numbers');
  assert.equal(csvCell(null), '');
});

test('phones and postal codes keep their leading zero, and only digit strings become text formulas', () => {
  assert.equal(csvDigits('09121112233'), '="09121112233"');
  assert.equal(csvDigits('=1+1'), "'=1+1");
  assert.equal(csvDigits(undefined), '');
});

test('the file is UTF-8 with a BOM, Persian headers, Solar Hijri Tehran dates and one line per order', () => {
  const row: ExportRow = {
    id: 'abcdef12-0000-4000-8000-000000000000', status: 'confirmed_cod', payment: 'cod', shipping: 'courier', code: null,
    subtotal: 900000, discount: 0, shippingCost: 120000, total: 1020000, createdAt: new Date('2026-03-20T20:31:00Z'),
    address: { name: '=cmd', mobile: '09121112233', province: 'تهران', city: 'تهران', address: 'خیابان، پلاک ۲', postal: '1234567890', notes: '' },
    items: 'مانتو — مشکی / M × 1', units: 1
  };
  const csv = ordersCsv([row]);
  assert.ok(csv.startsWith('﻿شماره سفارش,'));
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].startsWith('ABCDEF12,abcdef12-0000-4000-8000-000000000000,1405/01/01 00:01,ثبت‌شده، آماده پردازش,'));
  assert.ok(lines[1].includes(",'=cmd,") && lines[1].includes('="09121112233"') && lines[1].includes(',خیابان، پلاک ۲,'));
  assert.ok(lines[1].endsWith(',900000,0,,120000,1020000'));
  assert.equal(persianDateTime(new Date('2026-10-19T12:53:00Z')), '1405/07/27 16:23');
});
