import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import config from '../next.config';

// next/image no longer resizes photos (/_next/image is off), so every file is delivered exactly as committed or
// uploaded. Uploads are compressed by the API (backend/tests/image-compress.test.ts); committed images are checked here.
const PUBLIC = join(import.meta.dirname, '..', 'public');
const MAX_BYTES = 200 * 1024;
const files = (readdirSync(PUBLIC, { recursive: true }) as string[])
  .map(name => join(PUBLIC, name)).filter(path => statSync(path).isFile());

describe('images without the Next.js image optimizer', () => {
  it('serves images as stored instead of resizing them through /_next/image', () => {
    assert.equal(config.images?.unoptimized, true);
  });

  it('keeps every committed image small enough to send to a phone as it is', () => {
    const images = files.filter(path => /\.(avif|webp|jpe?g|png|gif|svg)$/i.test(path));
    assert.ok(images.length > 10);
    for (const path of images)
      assert.ok(statSync(path).size <= MAX_BYTES, path + ' is ' + Math.round(statSync(path).size / 1024) + ' KB');
  });

  it('uses compressed formats for photographs', () => {
    // PNG and GIF are fine for a small icon, never for a photograph.
    for (const path of files.filter(path => /\.(png|gif|bmp|tiff?)$/i.test(path)))
      assert.ok(statSync(path).size <= 50 * 1024, path + ': store photographs as AVIF, WebP or JPEG');
    for (const path of files.filter(path => extname(path) === '.avif'))
      assert.equal(readFileSync(path).toString('ascii', 4, 12), 'ftypavif', path + ' is a real AVIF file');
  });

  it('never links to /_next/image directly', () => {
    const sources = (readdirSync(join(import.meta.dirname, '..', 'src'), { recursive: true }) as string[])
      .filter(name => /\.(tsx?|css)$/.test(name));
    for (const name of sources)
      assert.doesNotMatch(readFileSync(join(import.meta.dirname, '..', 'src', name), 'utf8'), /\/_next\/image/, name);
  });
});
