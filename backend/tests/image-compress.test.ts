// Uploaded photos are served exactly as stored (the storefront has no image optimizer), so storing must shrink them.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { compressUpload, MAX_HEIGHT, MAX_SHARE_BYTES, MAX_STORED_BYTES, MAX_WIDTH, recompressStored, shareImage } from '../src/admin/image-compress';

/** A camera-sized photo: grainy (hard to compress), with camera and GPS metadata. */
const cameraPhoto = (width: number, height: number, format: 'jpeg' | 'png' | 'webp' = 'jpeg') =>
  sharp({ create: { width, height, channels: 3, background: '#b08a7a', noise: { type: 'gaussian', mean: 128, sigma: 24 } } })
    .toFormat(format, format === 'png' ? {} : { quality: 95 })
    .withExif({ IFD0: { Make: 'Phone', Model: 'Camera' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '35/1 41/1 0/1' } })
    .toBuffer();

describe('compressing an upload', () => {
  it('turns a multi-megabyte camera photo into a phone-sized WebP under the size budget', async () => {
    const original = await cameraPhoto(4000, 3000);
    assert.ok(original.length > 2 * 1024 * 1024, 'the test photo is several megabytes');
    const stored = await compressUpload(original);
    const meta = await sharp(stored).metadata();
    assert.equal(meta.format, 'webp');
    assert.ok(stored.length <= MAX_STORED_BYTES, stored.length + ' bytes');
    assert.ok(meta.width! <= MAX_WIDTH && meta.height! <= MAX_HEIGHT, meta.width + '×' + meta.height);
    assert.equal(meta.width, MAX_WIDTH, 'the aspect ratio is kept: 4:3 becomes 1200×900');
    assert.equal(meta.height, 900);
  });

  it('removes camera metadata such as the GPS position', async () => {
    const meta = await sharp(await compressUpload(await cameraPhoto(1600, 1200))).metadata();
    assert.equal(meta.exif, undefined);
  });

  it('keeps portrait photos within 1200×1600 and turns them upright from the EXIF orientation', async () => {
    const sideways = await sharp({ create: { width: 3200, height: 2400, channels: 3, background: '#556b2f' } })
      .jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const meta = await sharp(await compressUpload(sideways)).metadata();
    assert.equal(meta.width, MAX_WIDTH);
    assert.equal(meta.height, MAX_HEIGHT);
  });

  it('never enlarges a small photo', async () => {
    const meta = await sharp(await compressUpload(await cameraPhoto(480, 640, 'png'))).metadata();
    assert.deepEqual([meta.width, meta.height], [480, 640]);
  });

  it('rejects bytes that only look like an image', async () => {
    const fake = Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.alloc(64, 7)]);
    await assert.rejects(compressUpload(fake));
  });
});

describe('the share image for messengers', () => {
  it('is a 1200×630 JPEG under WhatsApp\'s size limit, made from a camera photo', async () => {
    const share = await shareImage(await cameraPhoto(3000, 4000));
    const meta = await sharp(share).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1200, 630]);
    assert.ok(share.length <= MAX_SHARE_BYTES, share.length + ' bytes');
    assert.equal(meta.exif, undefined);
  });

  it('shows the whole portrait photo on the studio gray instead of cropping it', async () => {
    const red = await sharp({ create: { width: 900, height: 1200, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const { data, info } = await sharp(await shareImage(red)).raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    const near = (actual: number[], expected: number[]) => actual.every((value, i) => Math.abs(value - expected[i]) < 12);
    assert.ok(near(pixel(600, 315), [255, 0, 0]), 'the photo is in the middle');
    assert.ok(near(pixel(600, 2), [255, 0, 0]) && near(pixel(600, 627), [255, 0, 0]), 'its full height is kept');
    assert.ok(near(pixel(20, 315), [0xEA, 0xEC, 0xF0]) && near(pixel(1180, 315), [0xEA, 0xEC, 0xF0]), 'studio gray at the sides');
  });
});

describe('recompressing a file stored before uploads were compressed', () => {
  for (const [extension, format] of [['jpg', 'jpeg'], ['png', 'png'], ['webp', 'webp']] as const) {
    it('keeps a ' + extension + ' file in its own format, so its address stays valid', async () => {
      const original = await cameraPhoto(1500, 2000, format);
      const stored = await recompressStored(original, extension);
      const meta = await sharp(stored).metadata();
      assert.equal(meta.format, format);
      assert.ok(stored.length < original.length);
      assert.ok(meta.width! <= MAX_WIDTH && meta.height! <= MAX_HEIGHT);
    });
  }

  it('returns the original when re-encoding would not make it smaller', async () => {
    const lowQuality = await sharp(await cameraPhoto(600, 800)).webp({ quality: 20 }).toBuffer();
    assert.equal(await recompressStored(lowQuality, 'webp'), lowQuality);
  });
});
