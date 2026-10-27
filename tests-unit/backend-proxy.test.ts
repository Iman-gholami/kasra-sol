import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clientAddress, forwardedFor, isSameOrigin, readBodyLimited, readTextLimited } from '@/lib/backend-proxy';
import { setEnv } from './helpers';

const headers = (values: Record<string, string>) => new Headers(values);
const post = (values: Record<string, string>) => new Request('http://shop.test/api/orders', { method: 'POST', headers: values });

describe('clientAddress', () => {
  it('trusts only the last X-Forwarded-For entry, which our own proxy appended', () => {
    assert.equal(clientAddress(headers({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' })), '203.0.113.9');
    assert.equal(clientAddress(headers({ 'x-forwarded-for': ' 2001:db8::1 ' })), '2001:db8::1');
  });
  it('falls back to X-Real-IP and ignores anything that is not an address', () => {
    assert.equal(clientAddress(headers({ 'x-real-ip': '198.51.100.7' })), '198.51.100.7');
    assert.equal(clientAddress(headers({ 'x-forwarded-for': 'evil<script>' })), undefined);
    assert.equal(clientAddress(headers({ 'x-forwarded-for': '1.2.3.4, ' + 'a'.repeat(60) })), undefined);
    assert.equal(clientAddress(headers({})), undefined);
  });
  it('forwards the address only when there is one', () => {
    assert.deepEqual(forwardedFor(headers({ 'x-real-ip': '198.51.100.7' })), { 'X-Forwarded-For': '198.51.100.7' });
    assert.deepEqual(forwardedFor(headers({})), {});
  });
});

describe('isSameOrigin (CSRF guard)', () => {
  it('accepts the configured public site URL', t => {
    setEnv(t, { NEXT_PUBLIC_SITE_URL: 'https://kasra.example/' });
    assert.equal(isSameOrigin(post({ origin: 'https://kasra.example', host: 'internal:3000' })), true);
  });
  it('accepts the Host the request was addressed to', t => {
    setEnv(t, { NEXT_PUBLIC_SITE_URL: undefined });
    assert.equal(isSameOrigin(post({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' })), true);
  });
  it('rejects other sites, a missing or malformed Origin, and a spoofed X-Forwarded-Host', t => {
    setEnv(t, { NEXT_PUBLIC_SITE_URL: 'https://kasra.example' });
    assert.equal(isSameOrigin(post({ origin: 'https://evil.example', host: 'kasra.example' })), false);
    assert.equal(isSameOrigin(post({ host: 'kasra.example' })), false);
    assert.equal(isSameOrigin(post({ origin: 'null', host: 'kasra.example' })), false);
    assert.equal(isSameOrigin(post({ origin: 'https://evil.example', host: 'shop', 'x-forwarded-host': 'evil.example' })), false);
    assert.equal(isSameOrigin(post({ origin: 'http://kasra.example', host: 'other' })), false, 'scheme must match too');
  });
});

describe('limited body readers', () => {
  const chunked = (chunks: string[]) => new Request('http://shop.test', {
    method: 'POST', duplex: 'half',
    body: new ReadableStream({ start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    } })
  } as RequestInit);

  it('returns the whole body when it fits', async () => {
    assert.equal(await readTextLimited(chunked(['سلام ', 'دنیا']), 100), 'سلام دنیا');
    assert.deepEqual(await readBodyLimited(new Request('http://shop.test', { method: 'POST', body: 'abc' }), 3),
      new TextEncoder().encode('abc'));
  });
  it('refuses a declared Content-Length above the limit without reading', async () => {
    const request = new Request('http://shop.test', { method: 'POST', body: 'x', headers: { 'content-length': '999' } });
    assert.equal(await readBodyLimited(request, 10), null);
  });
  it('stops reading a streamed body as soon as it passes the limit', async () => {
    assert.equal(await readTextLimited(chunked(['12345', '67890', 'overflow']), 10), null);
  });
  it('treats a missing body as empty', async () => {
    assert.equal(await readTextLimited(new Request('http://shop.test'), 10), '');
  });
});
