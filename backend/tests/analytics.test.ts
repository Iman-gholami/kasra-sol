import { it } from 'node:test';
import assert from 'node:assert/strict';
import { deviceOf, isBot, normalizePath, productSlugOf, referrerHost, sourceOf } from '../src/analytics-rules';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

it('ignores crawlers, link previews, scripts and headless browsers', () => {
  assert.equal(isBot(CHROME), false);
  assert.equal(isBot(IPHONE), false);
  for (const ua of [undefined, 'curl/8.5', 'Googlebot/2.1 (+http://www.google.com/bot.html)', 'TelegramBot (like TwitterBot)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0 Safari/537.36',
    'facebookexternalhit/1.1', 'python-requests/2.32']) assert.equal(isBot(ua), true, String(ua));
});
it('classifies devices from the user agent', () => {
  assert.equal(deviceOf(CHROME), 'desktop');
  assert.equal(deviceOf(IPHONE), 'mobile');
  assert.equal(deviceOf(TABLET), 'tablet');
});
it('keeps only the storefront path, never queries, fragments or back-office pages', () => {
  assert.equal(normalizePath('/shop?q=09121234567#top'), '/shop');
  assert.equal(normalizePath('/product/manto-01/'), '/product/manto-01');
  assert.equal(normalizePath('/'), '/');
  for (const path of ['/admin', '/admin/login', '/api/orders', '/_next/static/x.js', 'https://evil.example/', '/' + 'a'.repeat(400)])
    assert.equal(normalizePath(path), null, path);
  assert.equal(productSlugOf('/product/manto-01'), 'manto-01');
  assert.equal(productSlugOf('/shop'), null);
});
it('stores only the referring host and groups it into a source', () => {
  assert.equal(referrerHost('https://www.google.com/search?q=private'), 'google.com');
  assert.equal(referrerHost('https://l.instagram.com/?u=x'), 'instagram.com');
  assert.equal(referrerHost('javascript:alert(1)'), null);
  assert.equal(referrerHost('not a url'), null);
  assert.equal(sourceOf(null), 'direct');
  assert.equal(sourceOf('google.com'), 'search');
  assert.equal(sourceOf('google.co.uk'), 'search');
  assert.equal(sourceOf('instagram.com'), 'social');
  assert.equal(sourceOf('t.me'), 'social');
  assert.equal(sourceOf('torob.com'), 'compare');
  assert.equal(sourceOf('example.org'), 'other');
});
