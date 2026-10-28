// Contracts between the storefront/admin panel (src/) and the Fastify API (backend/src/). The two halves are
// written separately, so a change on one side can silently break the other; these tests catch that drift.
// They import backend code, so backend dependencies must be installed (`npm --prefix backend install`).
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import * as adminProxy from '@/app/api/admin/[...path]/route';
import { addressComplete, addressOrder, FIELD_MAX_LENGTH, normalizeMobile, normalizePostal, provinces, validate } from '@/components/checkout/fields';
import type { Fields } from '@/components/checkout/checkout-storage';
import { AUDIT_ACTION, AUDIT_GROUP, ORDER_STATUS, PERMISSION, PRODUCT_FIELD, TRANSITION_ACTIONS,
  type OrderStatus } from '@/components/admin/labels';
import { applyDiscount, discountCodes, MAX_CART_LINES, MAX_LINE_QUANTITY, orderTotals, paymentMethods, paymentRestriction,
  paymentById, resolveLines, shippingById, shippingMethods, shippingRestriction } from '@/lib/checkout';
import { parseFilters, queryProducts } from '@/lib/catalog';
import { categories, products } from '@/data/products';
import type { Product } from '@/types/store';
import { calculate, DomainError } from '../backend/src/pricing';
import { PERMISSIONS, assignable } from '../backend/src/admin/permissions';
import { ordersCsv, type ExportRow } from '../backend/src/admin/order-export';
import { json, setEnv, stubFetch } from './helpers';

// Modules that open the (lazy) database pool need a connection string; nothing here connects.
process.env.DATABASE_URL ??= 'postgres://contract:test@127.0.0.1:1/never-connected';
type Schema = { safeParse(value: unknown): { success: boolean; error?: { issues: unknown } } };
let api: {
  checkout: Schema & { shape: { fields: { shape: Record<string, unknown> } } };
  filters: Schema;
  productInput: Schema & { shape: { category: { options: string[] } } };
  ORDER_STATUSES: readonly OrderStatus[];
  nextStatuses: (payment: string, status: string) => readonly string[];
};
// Loaded by a computed path so that type-checking the storefront (`next build` in Docker) does not need the
// backend's packages (zod, drizzle, pg); running these tests does.
const backend = (module: string) => import('../backend/src/' + module).catch((error: Error) => {
  throw new Error('Contract tests import the API code; install its packages first (npm --prefix backend install). ' + error.message);
});
before(async () => {
  const [validation, catalog, schema, orders] = await Promise.all(
    ['validation', 'catalog', 'admin/product-schema', 'admin/order-routes'].map(backend));
  api = { checkout: validation.checkout, filters: catalog.filters, productInput: schema.productInput,
    ORDER_STATUSES: orders.ORDER_STATUSES, nextStatuses: orders.nextStatuses };
});

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const adminSources = () => [
  ...readdirSync('backend/src/admin').map(file => 'backend/src/admin/' + file),
  ...['[...path]', 'login', 'media'].map(route => 'src/app/api/admin/' + route + '/route.ts')
].map(path => ({ path, text: source(path) }));

const address: Fields = { name: 'مریم احمدی', mobile: '09121234567', province: 'تهران', city: 'تهران',
  address: 'خیابان آزادی، کوچه ۵، پلاک ۱۲', postal: '1234567890', notes: '' };
/** The order payload exactly as the payment step sends it. */
const payload = (fields: Fields, shipping = 'post', payment = 'online', code = '') => ({
  items: [{ productId: 'manto-01', colorId: 'black', size: 'M', quantity: 1 }],
  fields: { ...fields, mobile: normalizeMobile(fields.mobile), postal: normalizePostal(fields.postal) },
  shipping, payment, code
});

describe('checkout totals: the cart shows what the API will charge', () => {
  const at = (price: number): Product => ({ ...products[0], id: 'price-' + price, price, compareAt: undefined });
  const subtotals = [100_000, 999_999, 1_499_999, 1_500_000, 2_499_999, 2_500_000, 3_000_000, 10_000_000];
  const codes = ['', 'KASRA10', 'kasra ۱۰', 'WELCOME', 'welcome', 'BOGUS'];
  const places = [['تهران', 'تهران'], ['فارس', 'شیراز'], ['تهران', 'شهریار']];

  it('agrees on every subtotal, method, code and address, including what is refused', () => {
    let compared = 0;
    for (const subtotal of subtotals) for (const shipping of shippingMethods) for (const payment of paymentMethods)
      for (const code of codes) for (const [province, city] of places) {
        const label = [subtotal, shipping.id, payment.id, code || '-', city].join(' ');
        const product = at(subtotal);
        const refusedByShop = Boolean(shippingRestriction(shipping, province, city) ||
          paymentRestriction(payment, shipping.id) || (code && !applyDiscount(code, subtotal).ok));
        let server: ReturnType<typeof calculate> | null = null;
        try { server = calculate([{ price: subtotal, quantity: 1 }], shipping.id, payment.id, code, province, city); }
        catch (error) { assert.ok(error instanceof DomainError && error.status === 422, label); }
        assert.equal(server === null, refusedByShop, label + (refusedByShop ? ' is refused only by the shop' : ' is refused only by the API'));
        if (!server) continue;
        const shop = orderTotals(resolveLines([{ productId: product.id, colorId: 'x', size: 'M', quantity: 1 }], () => product),
          shipping.id, code);
        assert.deepEqual(server, { subtotal: shop.subtotal, discount: shop.discount, shipping: shop.shipping, total: shop.total }, label);
        compared++;
      }
    assert.ok(compared > 100, 'enough accepted combinations were compared');
  });

  it('offers only codes, shipping and payment methods the API accepts', () => {
    for (const { code } of discountCodes)
      assert.doesNotThrow(() => calculate([{ price: 5_000_000, quantity: 1 }], 'post', 'online', code, 'فارس', 'شیراز'), code);
    for (const shipping of shippingMethods)
      assert.equal(api.checkout.safeParse(payload(address, shipping.id, 'online')).success, true, shipping.id);
    for (const payment of paymentMethods)
      assert.equal(api.checkout.safeParse(payload(address, 'courier', payment.id)).success, true, payment.id);
  });

  it('agrees which spellings of the city are Tehran for the courier', () => {
    for (const city of ['تهران', ' تهران ', 'تهران،', 'تِهران', 'تهران‌', 'تهران.', 'کرج', 'تهرانپارس']) {
      const shop = !shippingRestriction(shippingById('courier'), 'تهران', city);
      let api = true;
      try { calculate([{ price: 1, quantity: 1 }], 'courier', 'cod', '', 'تهران', city); } catch { api = false; }
      assert.equal(api, shop, city);
    }
  });

  it('defaults to methods the API allows together', () => {
    assert.equal(paymentRestriction(paymentById('online'), 'post'), undefined);
    assert.doesNotThrow(() => calculate([{ price: 1, quantity: 1 }], shippingById('post').id, 'online', '', 'فارس', 'شیراز'));
  });

});

describe('checkout address: the form accepts what the API accepts', () => {
  const variants: [string, Partial<Fields>][] = [
    ['typed mobile', { mobile: '+98 912 123 4567' }], ['Persian mobile', { mobile: '۰۹۱۲۱۲۳۴۵۶۷' }],
    ['short mobile', { mobile: '0912123' }], ['foreign mobile', { mobile: '+441234567890' }],
    ['Persian postal code', { postal: '۱۲۳۴۵-۶۷۸۹۰' }], ['short postal code', { postal: '12345' }],
    ['short name', { name: ' ab ' }], ['short city', { city: 'x' }], ['short address', { address: ' پلاک ۱ ' }],
    ['notes', { notes: 'زنگ دوم' }], ['every province', {}]
  ];
  it('sends an address the API accepts exactly when the form says it is complete', () => {
    for (const [label, change] of variants) {
      const choices = label === 'every province' ? provinces : [address.province];
      for (const province of choices) {
        const fields = { ...address, ...change, province };
        assert.equal(api.checkout.safeParse(payload(fields)).success, addressComplete(fields), label + ' ' + province);
      }
    }
  });

  it('checks the same fields the API requires', () => {
    assert.deepEqual([...addressOrder].sort(), Object.keys(api.checkout.shape.fields.shape).sort());
    assert.equal(validate('notes', address), undefined);
  });

  it('limits text to the lengths the API accepts, so a long note cannot fail at payment', () => {
    for (const [field, limit] of Object.entries(FIELD_MAX_LENGTH) as [keyof Fields, number][])
      for (const length of [limit, limit + 1]) {
        const fields = { ...address, [field]: 'آ'.repeat(length) };
        assert.equal(api.checkout.safeParse(payload(fields)).success, addressComplete(fields), field + ' × ' + length);
      }
  });

  it('caps cart lines where the API does: units of one variant, and lines per order', () => {
    const order = payload(address);
    const line = (quantity: number, size = 'M') => ({ ...order.items[0], quantity, size });
    assert.equal(api.checkout.safeParse({ ...order, items: [line(MAX_LINE_QUANTITY)] }).success, true);
    assert.equal(api.checkout.safeParse({ ...order, items: [line(MAX_LINE_QUANTITY + 1)] }).success, false);
    const lines = (count: number) => Array.from({ length: count }, (_, i) => line(1, 'S' + i));
    assert.equal(api.checkout.safeParse({ ...order, items: lines(MAX_CART_LINES) }).success, true);
    assert.equal(api.checkout.safeParse({ ...order, items: lines(MAX_CART_LINES + 1) }).success, false);
  });

});

describe('catalog filters: the storefront only sends queries the API accepts', () => {
  it('accepts every filter value parseFilters lets through, including the extremes', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test' });
    const calls = stubFetch(t, () => json({ items: [], total: 0, page: 1, pages: 1 }));
    const extremes = [
      {}, { category: 'manto', q: 'ل'.repeat(500), size: 'x'.repeat(20), color: 'a'.repeat(79), min: '0',
        max: String(Number.MAX_SAFE_INTEGER), stock: '1', sale: '1', sort: 'price-desc', page: '999999' },
      ...categories.map(c => ({ category: c.slug })),
      ...['newest', 'price-asc', 'price-desc', 'featured'].map(sort => ({ sort }))
    ];
    for (const params of extremes) await queryProducts(parseFilters(params));
    for (const call of calls) {
      const query = Object.fromEntries(new URL(call.url).searchParams);
      const parsed = api.filters.safeParse(query);
      assert.ok(parsed.success, call.url + ' ' + JSON.stringify(parsed.error?.issues));
    }
  });

  it('uses the same category slugs', () => {
    for (const category of categories) assert.equal(api.filters.safeParse({ category: category.slug }).success, true);
    assert.deepEqual(categories.map(c => c.slug).sort(), [...api.productInput.shape.category.options].sort());
  });
});

describe('demo catalog: the seed data is valid for the API and the admin editor', () => {
  it('passes the product schema the admin panel saves with', () => {
    for (const product of products) {
      // The editor sends no creation date, and «no markdown» as null.
      const input: Record<string, unknown> = { ...product, compareAt: product.compareAt ?? null };
      delete input.createdAt;
      const parsed = api.productInput.safeParse(input);
      assert.ok(parsed.success, product.id + ' ' + JSON.stringify(parsed.error?.issues));
    }
  });
});

describe('admin panel ↔ API', () => {
  const routes = adminSources().flatMap(({ text }) => [...text.matchAll(/app\.(get|post|patch|put|delete)\('\/v1\/admin\/([^']+)'/g)])
    .map(([, method, path]) => ({ method: method.toUpperCase(), path }));
  // Login and uploads have dedicated Next.js routes (cookie handling, binary bodies).
  const dedicated = ['POST auth/login', 'POST media'];

  it('finds the admin endpoints in the API source', () => {
    assert.ok(routes.length >= 20, 'found ' + routes.length);
  });

  it('lets the browser reach every admin endpoint through the proxy', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test', NEXT_PUBLIC_SITE_URL: 'http://shop.test' });
    const calls = stubFetch(t, () => json({}));
    const uuid = '0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e';
    for (const { method, path } of routes) {
      if (dedicated.includes(method + ' ' + path)) continue;
      // Shop receipts, sales and held invoices are numbered (serial ids); `:code` is a shop label's EAN-13
      // (src/lib/ean13.ts), which the proxy accepts as 13 digits.
      const concrete = path.replace(/^(products)\/:id/, '$1/manto-01')
        .replace(/^(stock-receipts|store-sales|store-holds)\/:id/, '$1/42')
        .replace(/:id/g, uuid).replace(/:code/g, '2000000000015');
      const handler = adminProxy[method as 'GET' | 'POST' | 'PATCH' | 'PUT'];
      assert.ok(handler, method + ' is not proxied at all');
      const request = new NextRequest('http://shop.test/api/admin/' + concrete, { method,
        body: method === 'GET' ? undefined : '{}',
        headers: { origin: 'http://shop.test', host: 'shop.test', cookie: 'kasra_admin=' + 'a'.repeat(64) } });
      const response = await handler(request, { params: Promise.resolve({ path: concrete.split('/') }) });
      assert.notEqual(response.status, 404, method + ' ' + path + ' is not in the proxy allow-list');
      assert.equal(calls.at(-1)?.url, 'http://api.test/v1/admin/' + concrete);
    }
    for (const route of dedicated)
      assert.ok(routes.some(r => r.method + ' ' + r.path === route), route + ' still exists in the API');
  });

  it('has a Persian message for every error code the admin API can answer', () => {
    const handled = new Set([...source('src/components/admin/admin-api.ts').matchAll(/^\s+([a-z_]+): '/gm)].map(m => m[1]));
    // Answered only by the login route, whose form has its own wording for them.
    const loginOnly = ['invalid_credentials', 'https_required'];
    // Only for a malformed product id, which the panel never builds; the generic message covers it.
    const unreachable = ['invalid_id'];
    for (const { path, text } of adminSources()) {
      const codes = [...text.matchAll(/error: ([^}\n]+)/g)].flatMap(m => [...m[1].matchAll(/'([a-z_]+)'/g)].map(c => c[1]));
      codes.push(...[...text.matchAll(/return '([a-z]+_[a-z_]+)'/g)].map(m => m[1]));
      for (const code of codes)
        if (![...loginOnly, ...unreachable].includes(code)) assert.ok(handled.has(code), code + ' (from ' + path + ') has no message');
    }
    const loginForm = source('src/components/admin/login-form.tsx');
    assert.ok(loginForm.includes('https_required'), 'the login form explains https_required');
  });

  it('labels every audit action and group the API records', () => {
    const actions = adminSources().flatMap(({ text }) =>
      [...text.matchAll(/recordAudit\([^;]*?'([a-z]+\.[a-z_]+)'/g)].map(m => m[1]));
    actions.push('auth.login_locked', 'auth.login_failed');
    assert.ok(actions.length >= 15, 'found ' + actions.length);
    for (const action of actions) {
      assert.ok(AUDIT_ACTION[action], action + ' has no label');
      assert.ok(AUDIT_GROUP[action.split('.')[0]], action + ' is in no filter group');
    }
    const groups = /AUDIT_GROUPS = \[([^\]]+)\]/.exec(source('backend/src/admin/routes.ts'))![1].match(/[a-z]+/g)!;
    assert.deepEqual(Object.keys(AUDIT_GROUP).sort(), [...groups].sort());
  });

  it('names every product field reported in edit history', () => {
    const block = /CONTENT_FIELDS = \[([\s\S]*?)\] as const/.exec(source('backend/src/admin/product-routes.ts'))![1];
    const fields = [...block.matchAll(/\['(\w+)',/g)].map(m => m[1]);
    assert.deepEqual(Object.keys(PRODUCT_FIELD).sort(), fields.sort());
  });

  it('labels exactly the permissions an owner can grant', () => {
    const grantable = PERMISSIONS.filter(permission => assignable([permission]));
    assert.deepEqual(Object.keys(PERMISSION).sort(), [...grantable].sort());
    assert.equal(assignable(Object.keys(PERMISSION)), true);
  });

  it('labels every order status and every transition staff can record', () => {
    assert.deepEqual(Object.keys(ORDER_STATUS).sort(), [...api.ORDER_STATUSES].sort());
    for (const payment of ['cod', 'online'])
      for (const status of api.ORDER_STATUSES)
        for (const next of api.nextStatuses(payment, status))
          assert.ok(TRANSITION_ACTIONS[next], payment + ': ' + status + ' → ' + next + ' has no button label');
  });

  it('writes the same status names in the CSV export as the panel shows', () => {
    const row = (status: string): ExportRow => ({ id: '00000000-0000-4000-8000-000000000000', status, payment: 'cod',
      shipping: 'courier', code: null, subtotal: 0, discount: 0, shippingCost: 0, total: 0, createdAt: new Date(0),
      address: {}, items: '', units: 0 });
    for (const status of api.ORDER_STATUSES)
      assert.ok(ordersCsv([row(status)]).includes(',' + ORDER_STATUS[status].label + ','), status);
  });
});
