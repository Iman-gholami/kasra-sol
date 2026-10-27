import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminApiError, adminApi, adminDownload, errorMessage } from '@/components/admin/admin-api';
import { AUDIT_ACTION, CATEGORY, digitsOnly, formatDateTime, formatNumber, formatToman, ORDER_STATUS, paymentState,
  PRODUCT_STATUS, ROLE, statusLabel, statusTone, toLatinDigits } from '@/components/admin/labels';
import { markModal } from '@/components/ui/document-flags';
import { isAdminPath } from '@/components/layout/store-chrome';
import { json, setGlobal, stubFetch } from './helpers';

describe('admin labels', () => {
  it('names every order status, and shows unknown ones as they are', () => {
    assert.equal(statusLabel('delivered'), 'تحویل‌شده');
    assert.equal(statusTone('delivered'), 'success');
    assert.equal(statusLabel('lost_in_space'), 'lost_in_space');
    assert.equal(statusTone('lost_in_space'), 'neutral');
    for (const [status, { label }] of Object.entries(ORDER_STATUS)) assert.ok(label, status);
  });

  it('never presents an order as paid: no payment is verified yet', () => {
    assert.deepEqual(paymentState('online', 'pending_payment'), { label: 'پرداخت‌نشده', tone: 'danger' });
    assert.deepEqual(paymentState('cod', 'confirmed_cod'), { label: 'پرداخت هنگام تحویل', tone: 'warning' });
    assert.deepEqual(paymentState('cod', 'delivered'), { label: 'دریافت وجه ثبت نشده', tone: 'warning' });
    assert.equal(paymentState('online', 'cancelled').tone, 'neutral');
    for (const payment of ['cod', 'online'])
      for (const status of Object.keys(ORDER_STATUS))
        assert.doesNotMatch(paymentState(payment, status).label, /^پرداخت‌شده|^پرداخت شده/, payment + ' ' + status);
  });

  it('labels product states, categories and roles', () => {
    assert.deepEqual(Object.keys(PRODUCT_STATUS).sort(), ['active', 'archived', 'draft']);
    assert.deepEqual(Object.keys(CATEGORY).sort(), ['manto', 'shomiz', 'tshirt']);
    assert.deepEqual(Object.keys(ROLE).sort(), ['manager', 'owner', 'staff']);
    for (const action of Object.keys(AUDIT_ACTION)) assert.match(action, /^[a-z]+\.[a-z_]+$/, action);
  });

  it('reads digits typed on a Persian keyboard in numeric fields', () => {
    assert.equal(toLatinDigits('۱۲۳٤٥'), '12345');
    assert.equal(digitsOnly('۱٬۲۵۰٬۰۰۰ تومان'), '1250000');
    assert.equal(digitsOnly(''), '');
  });

  it('formats money, including amounts beyond Number precision sent as strings', () => {
    assert.equal(formatToman(1500), '۱٬۵۰۰ تومان');
    assert.equal(formatToman('12345678901234567890'), '۱۲٬۳۴۵٬۶۷۸٬۹۰۱٬۲۳۴٬۵۶۷٬۸۹۰ تومان');
    assert.equal(formatNumber(BigInt(10)), '۱۰');
  });

  it('shows times in Tehran on the Solar Hijri calendar, whatever the server time zone', () => {
    const text = formatDateTime('2026-03-20T20:31:00Z');
    assert.match(text, /۱ فروردین ۱۴۰۵/);
    assert.match(text, /۰۰:۰۱/);
  });
});

describe('AdminApiError', () => {
  it('uses the message for a known error code', () => {
    assert.equal(new AdminApiError(409, 'username_taken', {}).message, 'این نام کاربری قبلاً استفاده شده است.');
  });
  it('falls back on the HTTP status for unknown codes', () => {
    assert.match(new AdminApiError(403, '', {}).message, /مجوز/);
    assert.match(new AdminApiError(401, 'mystery', {}).message, /دوباره وارد شوید/);
    assert.match(new AdminApiError(413, '', {}).message, /حجم/);
    assert.match(new AdminApiError(429, '', {}).message, /صبر کنید/);
    assert.match(new AdminApiError(500, '', {}).message, /کد 500/);
  });
  it('turns any thrown value into a readable message', () => {
    assert.equal(errorMessage(new Error('x')), 'x');
    assert.equal(errorMessage('boom'), 'خطای ناشناخته رخ داد.');
  });
});

describe('adminApi', () => {
  it('calls the same-origin proxy, sending JSON only when there is a body', async t => {
    const calls = stubFetch(t, () => json({ ok: true }));
    assert.deepEqual(await adminApi('products?page=2'), { ok: true });
    await adminApi('products/x/price', { method: 'PATCH', body: { price: 10 }, headers: { 'If-Match': '"abc"' } });
    assert.equal(calls[0].url, '/api/admin/products?page=2');
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.cache, 'no-store');
    assert.deepEqual(calls[0].init.headers, {});
    assert.equal(calls[0].init.body, undefined);
    assert.equal(calls[1].init.method, 'PATCH');
    assert.equal(calls[1].init.body, '{"price":10}');
    assert.deepEqual(calls[1].init.headers, { 'Content-Type': 'application/json', 'If-Match': '"abc"' });
  });

  it('throws the API error code with its data', async t => {
    stubFetch(t, () => json({ error: 'stock_changed', stock: 3 }, { status: 409 }));
    await assert.rejects(adminApi('variants/x/stock'), (error: unknown) =>
      error instanceof AdminApiError && error.status === 409 && error.code === 'stock_changed' && error.data.stock === 3);
  });

  it('reports a network failure as an unreachable server, but lets an abort through', async t => {
    stubFetch(t, () => { throw new TypeError('fetch failed'); });
    await assert.rejects(adminApi('orders'), (error: unknown) => error instanceof AdminApiError && error.code === 'backend_unavailable');
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(adminApi('orders', { signal: controller.signal }), (error: unknown) => !(error instanceof AdminApiError));
  });

  it('copes with an error response that is not JSON', async t => {
    stubFetch(t, () => new Response('<html>Bad gateway</html>', { status: 502 }));
    await assert.rejects(adminApi('orders'), (error: unknown) => error instanceof AdminApiError && error.code === '');
  });

  it('announces an expired session so the panel can return to the login page', async t => {
    const page = new EventTarget();
    setGlobal(t, 'window', page);
    let announced = 0;
    page.addEventListener('kasra-admin-unauthorized', () => announced++);
    stubFetch(t, () => json({ error: 'unauthorized' }, { status: 401 }));
    await assert.rejects(adminApi('auth/me'));
    assert.equal(announced, 1);
  });

  it('downloads a file under the name the server suggests', async t => {
    const timers: (() => void)[] = [];
    t.mock.method(globalThis, 'setTimeout', (callback: () => void) => { timers.push(callback); return 0; });
    const clicked: { href: string; download: string }[] = [];
    setGlobal(t, 'document', {
      createElement: () => {
        const link = { href: '', download: '', click: () => clicked.push({ href: link.href, download: link.download }), remove() {} };
        return link;
      },
      body: { append() {} }
    });
    const revoke = t.mock.method(URL, 'revokeObjectURL', () => {});
    t.mock.method(URL, 'createObjectURL', () => 'blob:orders');
    stubFetch(t, () => new Response('﻿a,b', { headers: { 'Content-Disposition': 'attachment; filename="kasra-orders-2026-10-27.csv"' } }));
    await adminDownload('orders/export?status=all', 'orders.csv');
    assert.deepEqual(clicked, [{ href: 'blob:orders', download: 'kasra-orders-2026-10-27.csv' }]);
    assert.equal(revoke.mock.callCount(), 0, 'the link stays valid while the browser starts the download');
    timers.forEach(callback => callback());
    assert.equal(revoke.mock.callCount(), 1);
  });
});

describe('document flags', () => {
  it('keeps the modal flag while any modal is open, and never counts below zero', t => {
    const dataset: Record<string, string> = {};
    setGlobal(t, 'document', { documentElement: { dataset } });
    markModal(true);
    markModal(true);
    markModal(false);
    assert.ok('modalOpen' in dataset);
    markModal(false);
    assert.ok(!('modalOpen' in dataset));
    markModal(false);
    markModal(true);
    assert.ok('modalOpen' in dataset, 'an extra close must not hide the next modal');
    markModal(false);
  });
});

describe('store chrome', () => {
  it('treats only the back office as admin pages', () => {
    assert.equal(isAdminPath('/admin'), true);
    assert.equal(isAdminPath('/admin/login'), true);
    assert.equal(isAdminPath('/administration-guide'), false);
    assert.equal(isAdminPath('/'), false);
  });
});
