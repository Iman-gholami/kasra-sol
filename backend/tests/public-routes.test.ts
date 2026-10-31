// Storefront-facing routes, run with Fastify's inject() against an in-memory database stand-in.
import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { database, queries, type Query } from './support/fake-db';
import { tehranDate } from '../src/admin/calendar';

process.env.ORDER_TOKEN_SECRET ??= 'unit-test-order-token-secret-0123456789abcdef';
const { orderRoutes } = await import('../src/orders');
const { analyticsRoutes } = await import('../src/analytics');
const { mediaRoutes } = await import('../src/admin/media');
const { MediaStore } = await import('../src/admin/media-store');

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const order = {
  items: [{ productId: 'manto-01', colorId: 'black', size: 'M', quantity: 1 }],
  fields: { name: 'مشتری آزمایشی', mobile: '09121234567', province: 'تهران', city: 'تهران',
    address: 'خیابان آزادی، پلاک ۱۲', postal: '1234567890', notes: '' },
  shipping: 'courier', payment: 'cod', code: ''
};

let app: FastifyInstance;
let mediaDir = '';
before(async () => {
  mediaDir = await mkdtemp(join(tmpdir(), 'kasra-media-'));
  process.env.MEDIA_DIR = mediaDir;
  app = Fastify({ trustProxy: true });
  await app.register(orderRoutes, {});
  await app.register(analyticsRoutes);
  await app.register(async scope => mediaRoutes(scope, async (_req, reply) => { await reply.code(401).send(); return null; },
    new MediaStore(null, mediaDir)));
  await app.ready();
});

describe('placing an order', () => {
  const place = (body: unknown, key?: string) => app.inject({ method: 'POST', url: '/v1/orders', payload: body as object,
    headers: key === undefined ? {} : { 'idempotency-key': key } });

  it('needs a valid cart and address before anything is read', async () => {
    database();
    for (const body of [{}, { ...order, items: [] }, { ...order, fields: { ...order.fields, mobile: '123' } },
      { ...order, shipping: 'drone' }, { ...order, items: [{ ...order.items[0], quantity: 21 }] }]) {
      const response = await place(body, 'k'.repeat(32));
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error, 'invalid_payload');
    }
    assert.equal(queries.length, 0);
  });

  it('needs an idempotency key, so a retried request can never create a second order', async () => {
    database();
    for (const key of [undefined, '', 'short', 'k'.repeat(101), 'has spaces in it 123', '../../../etc/passwd!!']) {
      const response = await place(order, key);
      assert.equal(response.statusCode, 400, String(key));
      assert.deepEqual(response.json(), { error: 'idempotency_key_required' });
    }
    assert.equal(queries.length, 0);
  });

  it('validates a price quote the same way', async () => {
    database();
    const response = await app.inject({ method: 'POST', url: '/v1/checkout/quote', payload: { ...order, payment: 'bitcoin' } });
    assert.equal(response.statusCode, 400);
    assert.equal(queries.length, 0);
  });

  it('answers 404 for a receipt id that is not a UUID, without a lookup', async () => {
    database();
    const response = await app.inject({ method: 'GET', url: '/v1/orders/1%20OR%201=1' });
    assert.equal(response.statusCode, 404);
    assert.equal(queries.length, 0);
  });
});

describe('page-view statistics', () => {
  const view = (payload: unknown, userAgent = CHROME, ip = '203.0.113.10') => app.inject({
    method: 'POST', url: '/v1/analytics/view', payload: payload as object,
    headers: { 'user-agent': userAgent, 'x-forwarded-for': ip } });
  const recorded = () => queries.filter(q => q.text.startsWith('INSERT INTO page_views'));
  function tables() {
    database((query: Query) => query.text.startsWith('SELECT salt') ? { rows: [{ salt: 'today-salt' }] } : { rows: [] });
  }

  it('answers 204 and records nothing for bots, back-office pages and malformed beacons', async () => {
    tables();
    for (const [payload, agent] of [[{ path: '/' }, 'Googlebot/2.1 (+http://www.google.com/bot.html)'], [{ path: '/' }, 'curl/8'],
      [{ path: '/admin/orders' }, CHROME], [{ path: '/api/orders' }, CHROME], [{ path: 'https://evil.example/' }, CHROME],
      [{ path: '/', extra: 'field' }, CHROME], [{}, CHROME], [{ path: '/' + 'x'.repeat(700) }, CHROME]] as const) {
      const response = await view(payload, agent);
      assert.equal(response.statusCode, 204, JSON.stringify(payload) + ' ' + agent);
    }
    assert.equal(recorded().length, 0);
  });

  it('records the page, product, device and referring site, and never the query, address or browser string', async () => {
    tables();
    const response = await view({ path: '/product/manto-01?phone=09121234567#reviews', referrer: 'https://www.google.com/search?q=secret' });
    assert.equal(response.statusCode, 204);
    const [row] = recorded();
    const [day, path, slug, host, device, visitor] = row.values as string[];
    assert.equal(day, tehranDate(new Date()));
    assert.deepEqual([path, slug, host, device], ['/product/manto-01', 'manto-01', 'google.com', 'desktop']);
    assert.match(visitor, /^[a-f0-9]{32}$/);
    const stored = JSON.stringify(queries.map(q => q.values));
    for (const secret of ['09121234567', '203.0.113.10', 'Chrome/130', 'secret', 'reviews'])
      assert.ok(!stored.includes(secret), secret + ' reached the database');
  });

  it('counts the same browser on the same address as one visitor, and different devices separately', async () => {
    tables();
    await view({ path: '/' });
    await view({ path: '/shop' });
    await view({ path: '/' }, IPHONE);
    const visitors = recorded().map(q => q.values[5]);
    assert.equal(visitors[0], visitors[1]);
    assert.notEqual(visitors[0], visitors[2]);
    assert.equal(recorded()[2].values[4], 'mobile');
  });
});

describe('uploaded images', () => {
  const file = '0b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e.png';

  it('serves a stored image with headers that stop browsers from running it', async () => {
    await writeFile(join(mediaDir, file), Buffer.from([137, 80, 78, 71]));
    const response = await app.inject({ method: 'GET', url: '/v1/media/' + file });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'image/png');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.match(String(response.headers['content-security-policy']), /sandbox/);
    assert.equal(response.headers['cache-control'], 'public,max-age=31536000,immutable');
  });

  it('answers 404 for missing files and for any name that is not an uploaded image', async () => {
    for (const name of ['1b6f3c7e-1d2a-4b5c-8d9e-0f1a2b3c4d5e.png', '..%2Fsecret.png', 'logo.svg', file.replace('.png', '.svg')])
      assert.equal((await app.inject({ method: 'GET', url: '/v1/media/' + name })).statusCode, 404, name);
  });

  it('accepts uploads only after the permission check', async () => {
    const response = await app.inject({ method: 'POST', url: '/v1/admin/media', payload: Buffer.alloc(32),
      headers: { 'content-type': 'image/png' } });
    assert.equal(response.statusCode, 401);
  });

  describe('as a member of staff allowed to edit products', () => {
    let staff: FastifyInstance;
    before(async () => {
      staff = Fastify();
      await staff.register(async scope => mediaRoutes(scope, async () => ({ id: 'staff-1' }), new MediaStore(null, mediaDir)));
      await staff.ready();
    });
    const upload = (payload: Buffer, type: string) =>
      staff.inject({ method: 'POST', url: '/v1/admin/media', payload, headers: { 'content-type': type } });

    it('stores a photo re-encoded as a phone-sized WebP and audits both sizes', async () => {
      database(() => ({ rows: [] }));
      const photo = await sharp({ create: { width: 2400, height: 3200, channels: 3, background: '#c9b49a',
        noise: { type: 'gaussian', mean: 128, sigma: 5 } } }).jpeg({ quality: 85 }).toBuffer();
      assert.ok(photo.length < 2 * 1024 * 1024, 'under the upload limit');
      const response = await upload(photo, 'image/jpeg');
      assert.equal(response.statusCode, 201);
      const url: string = response.json().url;
      assert.match(url, /^\/api\/media\/[0-9a-f-]{36}\.webp$/);
      const served = await staff.inject({ method: 'GET', url: '/v1/media/' + url.split('/').pop() });
      assert.equal(served.headers['content-type'], 'image/webp');
      const meta = await sharp(served.rawPayload).metadata();
      assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 1200, 1600]);
      assert.ok(served.rawPayload.length < photo.length);
      const audit = queries.find(query => query.text.includes('audit'));
      assert.ok(audit, 'the upload is audited');
      assert.match(JSON.stringify(audit.values), /storedBytes/);
    });

    it('refuses a file whose bytes are not the image its type claims', async () => {
      database(() => ({ rows: [] }));
      const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#000000' } }).png().toBuffer();
      assert.equal((await upload(png, 'image/jpeg')).statusCode, 415);
      const broken = Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(64, 7)]);
      assert.equal((await upload(broken, 'image/jpeg')).statusCode, 415);
      assert.equal(queries.length, 0, 'nothing is stored or audited');
    });
  });
});
