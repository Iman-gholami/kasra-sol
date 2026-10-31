import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as list } from '@/app/api/shopino/products/route';
import { GET as detail } from '@/app/api/shopino/products/[id]/route';
import { POST as tracking } from '@/app/api/shopino/tracking/route';
import { json, setEnv, stubFetch } from './helpers';

describe('Shopino catalog proxy', () => {
  it('forwards pagination and the visitor address without caching stock', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test' });
    const calls = stubFetch(t, () => json([{ id: 'manto-01' }]));
    const response = await list(new NextRequest('https://shop.test/api/shopino/products?page=2&per_page=20&extra=ignore', {
      headers: { 'x-forwarded-for': '1.1.1.1, 203.0.113.8' }
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [{ id: 'manto-01' }]);
    assert.equal(calls[0].url, 'http://api.test/v1/shopino/products?page=2&per_page=20');
    assert.equal(calls[0].init.headers!['X-Forwarded-For'], '203.0.113.8');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  it('forwards a valid product ID, rejects unsafe paths and propagates missing products', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test' });
    const calls = stubFetch(t, () => json({ error: 'not_found' }, { status: 404 }));
    const request = new NextRequest('https://shop.test/api/shopino/products/missing');
    const missing = await detail(request, { params: Promise.resolve({ id: 'missing' }) });
    assert.equal(missing.status, 404);
    assert.equal(calls[0].url, 'http://api.test/v1/shopino/products/missing');
    const unsafe = await detail(request, { params: Promise.resolve({ id: '../orders' }) });
    assert.equal(unsafe.status, 404);
    assert.equal(calls.length, 1);
  });

  it('returns a service error when the backend is not configured', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: undefined });
    assert.equal((await list(new NextRequest('https://shop.test/api/shopino/products'))).status, 503);
  });

  it('forwards authenticated server-to-server tracking requests and preserves the result', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test' });
    const calls = stubFetch(t, () => json({ codes: [null, 'POST123'] }));
    const response = await tracking(new NextRequest('https://shop.test/api/shopino/tracking', {
      method: 'POST', headers: { authorization: 'Bearer ' + 'a'.repeat(64), 'content-type': 'application/json' },
      body: JSON.stringify({ order_ids: [1, 2] })
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { codes: [null, 'POST123'] });
    assert.equal(calls[0].url, 'http://api.test/v1/shopino/tracking');
    assert.equal(calls[0].init.headers!.Authorization, 'Bearer ' + 'a'.repeat(64));
    assert.equal(calls[0].init.body, '{"order_ids":[1,2]}');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  it('rejects oversized tracking requests without contacting the backend', async t => {
    setEnv(t, { BACKEND_INTERNAL_URL: 'http://api.test' });
    const calls = stubFetch(t, () => json({}));
    const response = await tracking(new NextRequest('https://shop.test/api/shopino/tracking', {
      method: 'POST', body: 'x'.repeat(32_769)
    }));
    assert.equal(response.status, 413);
    assert.equal(calls.length, 0);
  });
});
