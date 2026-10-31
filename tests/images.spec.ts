import { expect, test } from '@playwright/test';
import { products } from '../src/data/products';

// Photos are served as stored (next.config.ts `images.unoptimized`), never through the /_next/image resizer, and
// none of them is a heavy original.
const MAX_IMAGE_BYTES = 400 * 1024;

for (const path of ['/', '/shop', '/product/' + products[0].slug]) {
  test('loads the photos of ' + path + ' directly, without /_next/image', async ({ page }) => {
    const images: { url: string; bytes: number }[] = [];
    page.on('response', async response => {
      if (response.request().resourceType() !== 'image') return;
      images.push({ url: new URL(response.url()).pathname, bytes: (await response.body().catch(() => Buffer.alloc(0))).length });
    });
    await page.goto(path);
    await page.mouse.wheel(0, 4000);
    await page.waitForLoadState('networkidle');

    const sources = await page.locator('main img').evaluateAll(nodes => nodes.map(node => node.getAttribute('src') ?? ''));
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) expect(src, 'a stored file, not the optimizer').not.toContain('/_next/image');
    const local = images.filter(image => !image.url.startsWith('/logo.aspx'));
    expect(local.length).toBeGreaterThan(0);
    for (const image of local) {
      expect(image.url).not.toContain('/_next/image');
      expect(image.bytes, image.url).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
    }
  });
}
