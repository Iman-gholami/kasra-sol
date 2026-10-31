import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as list } from '@/app/api/shopino/products/route';
import { GET as detail } from '@/app/api/shopino/products/[id]/route';
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
});
