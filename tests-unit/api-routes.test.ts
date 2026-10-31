import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import * as adminProxy from '@/app/api/admin/[...path]/route';
import { POST as login } from '@/app/api/admin/login/route';
import { POST as uploadMedia } from '@/app/api/admin/media/route';
import { POST as recordView } from '@/app/api/analytics/view/route';
import { GET as lookup } from '@/app/api/catalog/lookup/route';
import { GET as health } from '@/app/api/health/route';
import { GET as mediaFile } from '@/app/api/media/[file]/route';
import { POST as placeOrder } from '@/app/api/orders/route';
import { GET as suggestions } from '@/app/api/search-suggestions/route';
import { json, setEnv, stubFetch } from './helpers';

const SITE = 'http://shop.test';
const API = 'http://api.test';
const TOKEN = 'a'.repeat(64);
const UUID = '0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e';
const live = { BACKEND_INTERNAL_URL: API, NEXT_PUBLIC_SITE_URL: SITE };

type Options = { method?: string; headers?: Record<string, string>; body?: BodyInit; cookie?: string; origin?: string | null };
function request(path: string, { method = 'GET', headers = {}, body, cookie, origin = SITE }: Options = {}) {
  return new NextRequest(SITE + path, { method, body, headers: {
    host: 'shop.test', ...(origin ? { origin } : {}), ...(cookie ? { cookie: 'kasra_admin=' + cookie } : {}), ...headers
  } });
}
const admin = (path: string, options: Options = {}) => {
  const req = request('/api/admin/' + path, { cookie: TOKEN, ...options });
  const handler = adminProxy[(options.method ?? 'GET') as 'GET' | 'POST' | 'PATCH' | 'PUT'];
  return handler(req, { params: Promise.resolve({ path: path.split('?')[0].split('/') }) });
};
const setCookie = (response: Response) => response.headers.get('set-cookie') ?? '';

describe('GET /api/health', () => {
  it('answers ok without caching', async () => {
    const response = health();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'kasra-frontend' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

describe('admin API proxy /api/admin/*', () => {
  it('forwards only allow-listed endpoints and methods', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ ok: true }));
    for (const [method, path] of [['GET', 'auth/login'], ['GET', 'staff/' + UUID], ['POST', 'orders/export'],
      ['GET', 'products/Bad_ID'], ['PATCH', 'products/x'], ['PUT', 'orders/' + UUID], ['GET', '../health'],
      ['GET', 'products/manto-01/variants/extra'], ['POST', 'media']]) {
      const response = await admin(path, { method, body: method === 'GET' ? undefined : '{}' });
      assert.equal(response.status, 404, method + ' ' + path);
    }
    assert.equal(calls.length, 0);
  });

  it('refuses state-changing requests from another site (CSRF) but allows reads', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ ok: true }));
    const forged = await admin('auth/logout', { method: 'POST', origin: 'https://evil.example', body: '{}' });
    assert.equal(forged.status, 403);
    assert.deepEqual(await forged.json(), { error: 'forbidden_origin' });
    assert.equal((await admin('auth/me', { origin: null })).status, 200);
    assert.equal(calls.length, 1);
  });

  it('needs a well-formed session cookie before calling the API', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ ok: true }));
    assert.equal((await admin('auth/me', { cookie: '' })).status, 401);
    assert.equal((await admin('auth/me', { cookie: 'not-a-token' })).status, 401);
    assert.equal(calls.length, 0);
  });

  it('answers 503 when no API is configured', async t => {
    setEnv(t, { ...live, BACKEND_INTERNAL_URL: undefined });
    assert.equal((await admin('auth/me')).status, 503);
  });

  it('passes the session as a bearer token with the visitor address, and only known query parameters', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ items: [] }));
    await admin('products?q=' + 'x'.repeat(300) + '&status=active&limit=5&admin=1&token=steal', {
      headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.5' } });
    const url = new URL(calls[0].url);
    assert.equal(url.origin + url.pathname, API + '/v1/admin/products');
    assert.deepEqual([...url.searchParams.keys()].sort(), ['limit', 'q', 'status']);
    assert.equal(url.searchParams.get('q')!.length, 200, 'values are capped');
    const headers = calls[0].init.headers!;
    assert.equal(headers.Authorization, 'Bearer ' + TOKEN);
    assert.equal(headers['X-Forwarded-For'], '203.0.113.5');
    assert.equal(headers['Content-Type'], undefined, 'no body, no content type');
    assert.equal(calls[0].init.body, undefined);
  });

  it('drops the query string of endpoints that take none', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({}));
    await admin('auth/me?impersonate=owner');
    assert.equal(calls[0].url, API + '/v1/admin/auth/me');
  });

  it('forwards the body, method and If-Match of edits', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ ok: true }));
    const etag = '"' + 'b'.repeat(64) + '"';
    await admin('products/manto-01', { method: 'PUT', body: '{"name":"x"}', headers: { 'if-match': etag } });
    assert.equal(calls[0].url, API + '/v1/admin/products/manto-01');
    assert.equal(calls[0].init.method, 'PUT');
    assert.equal(calls[0].init.body, '{"name":"x"}');
    assert.equal(calls[0].init.headers!['If-Match'], etag);
    assert.equal(calls[0].init.headers!['Content-Type'], 'application/json');
  });

  it('refuses bodies over 64 KiB', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ ok: true }));
    const response = await admin('products', { method: 'POST', body: 'x'.repeat(65_537) });
    assert.equal(response.status, 413);
    assert.equal(calls.length, 0);
  });

  it('relays the API status and always answers JSON, uncached', async t => {
    setEnv(t, live);
    stubFetch(t, () => new Response('{"error":"forbidden"}', { status: 403, headers: { 'Content-Type': 'text/html' } }));
    const response = await admin('staff');
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'forbidden' });
  });

  it('streams the order export as a CSV file, keeping the byte-order mark Excel needs', async t => {
    setEnv(t, live);
    const csv = '﻿شماره سفارش,مبلغ\r\n';
    stubFetch(t, () => new Response(csv, { headers: { 'Content-Disposition': 'attachment; filename="kasra-orders-x.csv"' } }));
    const response = await admin('orders/export?status=open&period=7d');
    assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="kasra-orders-x.csv"');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(new TextDecoder().decode(bytes), csv.slice(1), 'the decoder strips the BOM it found');
  });

  it('answers a failed export as JSON, not as a file', async t => {
    setEnv(t, live);
    stubFetch(t, () => json({ error: 'export_too_large' }, { status: 422 }));
    const response = await admin('orders/export');
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.equal(response.headers.get('content-disposition'), null);
  });

  it('clears the session cookie on logout and whenever the API says the session is gone', async t => {
    setEnv(t, live);
    let status = 200;
    stubFetch(t, () => json({}, { status }));
    assert.match(setCookie(await admin('auth/logout', { method: 'POST', body: '' })), /kasra_admin=;.*Max-Age=0/i);
    status = 401;
    assert.match(setCookie(await admin('orders')), /kasra_admin=;.*Max-Age=0/i);
    status = 200;
    assert.equal(setCookie(await admin('orders')), '');
  });

  it('reports an unreachable API as 502', async t => {
    setEnv(t, live);
    stubFetch(t, () => { throw new TypeError('fetch failed'); });
    const response = await admin('reports/overview');
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'backend_unavailable' });
  });
});

describe('POST /api/admin/login', () => {
  const body = JSON.stringify({ username: 'owner', password: 'correct horse battery' });
  const HTTPS = 'https://kasra.example';
  const secure = { BACKEND_INTERNAL_URL: API, NEXT_PUBLIC_SITE_URL: HTTPS };
  const attempt = (options: Options = {}) => login(request('/api/admin/login', { method: 'POST', body, origin: HTTPS, ...options }));

  it('sets a Secure, HttpOnly, SameSite=Strict session cookie and never returns the token', async t => {
    setEnv(t, secure);
    const calls = stubFetch(t, () => json({ token: TOKEN, user: { username: 'owner' } }));
    const response = await attempt();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { user: { username: 'owner' } });
    const cookie = setCookie(response);
    assert.match(cookie, new RegExp('kasra_admin=' + TOKEN));
    for (const flag of [/Secure/i, /HttpOnly/i, /SameSite=strict/i, /Max-Age=28800/]) assert.match(cookie, flag);
    assert.equal(calls[0].url, API + '/v1/admin/auth/login');
    assert.equal(calls[0].init.body, body);
  });

  it('allows plain HTTP on localhost for development, without the Secure flag', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: API, NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' });
    stubFetch(t, () => json({ token: TOKEN, user: {} }));
    const response = await attempt({ origin: 'http://127.0.0.1:3000' });
    assert.equal(response.status, 200);
    assert.doesNotMatch(setCookie(response), /Secure/i);
  });

  it('refuses to log in over plain HTTP anywhere else', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ token: TOKEN }));
    const response = await attempt({ origin: SITE });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'https_required' });
    assert.equal(calls.length, 0);
  });

  it('relays a failed login and sets no cookie', async t => {
    setEnv(t, secure);
    stubFetch(t, () => json({ error: 'invalid_credentials' }, { status: 401 }));
    const response = await attempt();
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'invalid_credentials' });
    assert.equal(setCookie(response), '');
  });

  it('never stores a malformed token', async t => {
    setEnv(t, secure);
    stubFetch(t, () => json({ token: 'short', user: {} }));
    const response = await attempt();
    assert.equal(response.status, 502);
    assert.equal(setCookie(response), '');
  });

  it('refuses other sites, oversized bodies and a missing API', async t => {
    setEnv(t, secure);
    const calls = stubFetch(t, () => json({ token: TOKEN }));
    assert.equal((await attempt({ origin: 'https://evil.example' })).status, 403);
    assert.equal((await attempt({ body: 'x'.repeat(8193) })).status, 413);
    assert.equal(calls.length, 0);
    setEnv(t, { BACKEND_INTERNAL_URL: undefined });
    assert.equal((await attempt()).status, 503);
  });
});

describe('POST /api/admin/media', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);
  const upload = (options: Options) => uploadMedia(request('/api/admin/media', { method: 'POST', cookie: TOKEN, ...options }));

  it('forwards the image bytes with the session and declared type', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ url: '/api/media/x.png' }, { status: 201 }));
    const response = await upload({ body: png, headers: { 'content-type': 'image/png' } });
    assert.equal(response.status, 201);
    assert.equal(calls[0].url, API + '/v1/admin/media');
    assert.equal(calls[0].init.headers!['Content-Type'], 'image/png');
    assert.equal(calls[0].init.headers!.Authorization, 'Bearer ' + TOKEN);
    assert.deepEqual(new Uint8Array(calls[0].init.body as Uint8Array), png);
  });

  it('accepts only JPEG, PNG and WebP up to 2 MiB from a signed-in same-site page', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({}));
    assert.equal((await upload({ body: png, headers: { 'content-type': 'image/svg+xml' } })).status, 415);
    assert.equal((await upload({ body: new Uint8Array(2 * 1024 * 1024 + 1), headers: { 'content-type': 'image/jpeg' } })).status, 413);
    assert.equal((await upload({ body: png, headers: { 'content-type': 'image/png' }, cookie: '' })).status, 401);
    assert.equal((await upload({ body: png, headers: { 'content-type': 'image/png' }, origin: 'https://evil.example' })).status, 403);
    assert.equal(calls.length, 0);
  });
});

describe('POST /api/orders', () => {
  const body = JSON.stringify({ items: [] });

  it('forwards the order with its idempotency key and the visitor address', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ id: 'order' }, { status: 201 }));
    const response = await placeOrder(request('/api/orders', { method: 'POST', body,
      headers: { 'idempotency-key': 'k'.repeat(20), 'x-real-ip': '198.51.100.4' } }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { id: 'order' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(calls[0].url, API + '/v1/orders');
    assert.equal(calls[0].init.body, body);
    assert.equal(calls[0].init.headers!['Idempotency-Key'], 'k'.repeat(20));
    assert.equal(calls[0].init.headers!['X-Forwarded-For'], '198.51.100.4');
  });

  it('relays business-rule errors from the API unchanged', async t => {
    setEnv(t, live);
    stubFetch(t, () => json({ error: 'business_rule', message: 'موجودی کافی نیست.' }, { status: 409 }));
    const response = await placeOrder(request('/api/orders', { method: 'POST', body }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).message, 'موجودی کافی نیست.');
  });

  it('refuses other sites, oversized carts and a missing API, and reports an unreachable API', async t => {
    setEnv(t, live);
    let fail = false;
    stubFetch(t, () => { if (fail) throw new TypeError('down'); return json({}); });
    assert.equal((await placeOrder(request('/api/orders', { method: 'POST', body, origin: 'https://evil.example' }))).status, 403);
    assert.equal((await placeOrder(request('/api/orders', { method: 'POST', body: 'x'.repeat(32_769) }))).status, 413);
    fail = true;
    assert.equal((await placeOrder(request('/api/orders', { method: 'POST', body }))).status, 502);
    setEnv(t, { BACKEND_INTERNAL_URL: undefined });
    assert.equal((await placeOrder(request('/api/orders', { method: 'POST', body }))).status, 503);
  });
});

describe('POST /api/analytics/view', () => {
  const view = (payload: unknown, options: Options = {}) =>
    recordView(request('/api/analytics/view', { method: 'POST', body: JSON.stringify(payload), ...options }));

  it('always answers 204, even when it records nothing', async t => {
    setEnv(t, { ...live, BACKEND_INTERNAL_URL: undefined });
    assert.equal((await view({ path: '/' })).status, 204);
    setEnv(t, live);
    stubFetch(t, () => { throw new Error('down'); });
    assert.equal((await view({ path: '/' })).status, 204);
    assert.equal((await recordView(request('/api/analytics/view', { method: 'POST', body: '{broken' }))).status, 204);
  });

  it('records the path and an external referrer, with the browser string and visitor address', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => new Response(null, { status: 204 }));
    await view({ path: '/shop', referrer: 'https://www.google.com/search?q=x' },
      { headers: { 'user-agent': 'Mozilla/5.0 test', 'x-real-ip': '198.51.100.8' } });
    assert.equal(calls[0].url, API + '/v1/analytics/view');
    assert.deepEqual(JSON.parse(calls[0].init.body as string), { path: '/shop', referrer: 'https://www.google.com/search?q=x' });
    assert.equal(calls[0].init.headers!['User-Agent'], 'Mozilla/5.0 test');
    assert.equal(calls[0].init.headers!['X-Forwarded-For'], '198.51.100.8');
  });

  it('drops a referrer from this same site, and caps long paths', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => new Response(null, { status: 204 }));
    await view({ path: '/' + 'a'.repeat(1000), referrer: SITE + '/cart' });
    assert.deepEqual(JSON.parse(calls[0].init.body as string), { path: '/' + 'a'.repeat(599) });
  });

  it('records nothing for requests from other sites or with oversized bodies', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => new Response(null, { status: 204 }));
    await view({ path: '/' }, { origin: 'https://evil.example' });
    await view({ path: '/'.repeat(3000) });
    assert.equal(calls.length, 0);
  });
});

describe('GET /api/catalog/lookup', () => {
  it('returns demo products in the requested order, skipping unknown and repeated ids', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: undefined });
    const response = await lookup(request('/api/catalog/lookup?ids=manto-02,missing-01,shomiz-01,manto-02'));
    assert.deepEqual((await response.json()).items.map((p: { id: string }) => p.id), ['manto-02', 'shomiz-01']);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  it('answers an empty list for no ids', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: undefined });
    assert.deepEqual(await (await lookup(request('/api/catalog/lookup'))).json(), { items: [] });
  });

  it('rejects malformed, too many or too long id lists before calling the API', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ items: [] }));
    const many = Array.from({ length: 81 }, (_, i) => 'p-' + i).join(',');
    for (const ids of ['Bad_ID', '../etc', many, 'a'.repeat(6001)])
      assert.equal((await lookup(request('/api/catalog/lookup?ids=' + encodeURIComponent(ids)))).status, 400, ids.slice(0, 20));
    assert.equal(calls.length, 0);
  });

  it('asks the API for the unique ids and relays its answer', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => json({ items: [{ id: 'a-01' }] }));
    const response = await lookup(request('/api/catalog/lookup?ids=a-01,a-01,b-02'));
    assert.deepEqual(await response.json(), { items: [{ id: 'a-01' }] });
    assert.equal(calls[0].url, API + '/v1/products/lookup?ids=' + encodeURIComponent('a-01,b-02'));
  });
});

describe('GET /api/media/[file]', () => {
  const file = UUID + '.png';
  const get = (name: string) => mediaFile(request('/api/media/' + name), { params: Promise.resolve({ file: name }) });

  it('serves uploaded images with strict, long-lived caching headers', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }));
    const response = await get(file);
    assert.equal(response.status, 200);
    assert.equal(calls[0].url, API + '/v1/media/' + file);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'public,max-age=31536000,immutable');
    assert.match(response.headers.get('content-security-policy') ?? '', /sandbox/);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3]);
  });

  it('answers 404 for anything but an uploaded image name, without calling the API', async t => {
    setEnv(t, live);
    const calls = stubFetch(t, () => new Response(''));
    for (const name of ['..%2F..%2Fetc%2Fpasswd', UUID + '.svg', 'logo.png', UUID.toUpperCase() + '.png'])
      assert.equal((await get(name)).status, 404, name);
    assert.equal(calls.length, 0);
  });

  it('relays a missing image and reports a missing or unreachable API', async t => {
    setEnv(t, live);
    let fail = false;
    stubFetch(t, () => { if (fail) throw new Error('down'); return new Response(null, { status: 404 }); });
    assert.equal((await get(file)).status, 404);
    fail = true;
    assert.equal((await get(file)).status, 502);
    setEnv(t, { BACKEND_INTERNAL_URL: undefined });
    assert.equal((await get(file)).status, 503);
  });
});

describe('GET /api/search-suggestions', () => {
  type Answer = { products: { name: string; href: string; category: string }[]; categories: { slug: string }[]; count: number };
  const suggest = async (q: string) => (await suggestions(request('/api/search-suggestions?q=' + encodeURIComponent(q)))).json() as Promise<Answer>;

  it('suggests at most four products, best match first, from the demo catalog', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: undefined });
    const answer = await suggest('لینن');
    assert.equal(answer.count, 13);
    assert.equal(answer.products.length, 4);
    assert.deepEqual(answer.products.slice(0, 2).map(p => p.name).sort(), ['شومیز لینن آوید', 'مانتو لینن ارغوان']);
    assert.match(answer.products[0].href, /^\/product\/[a-z0-9-]+$/);
  });

  it('suggests a category by its title', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: undefined });
    assert.deepEqual((await suggest('مانتو')).categories.map(c => c.slug), ['manto']);
  });

  it('answers empty for a blank query', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: undefined });
    assert.deepEqual(await suggest('  ، '), { products: [], categories: [], count: 0 });
  });

  it('asks the API in live mode, with a trimmed and capped query, and reports failures as 502', async t => {
    setEnv(t, live);
    let status = 200;
    const calls = stubFetch(t, () => json({ products: [], categories: [], count: 0 }, { status }));
    await suggest('  ' + 'ب'.repeat(150) + '  ');
    assert.equal(new URL(calls[0].url).searchParams.get('q'), 'ب'.repeat(100));
    status = 500;
    assert.equal((await suggestions(request('/api/search-suggestions?q=x'))).status, 502);
  });
});

