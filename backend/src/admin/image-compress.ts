import sharp from 'sharp';

/** The storefront serves photos as they are stored (next.config.ts `images.unoptimized`, no /_next/image resizing),
 * so every stored photo is already sized for the largest place it appears: a phone-width column at 3× density. */
export const MAX_WIDTH = 1200;
export const MAX_HEIGHT = 1600;
/** No stored photo is larger than this; the quality steps down until it fits. */
export const MAX_STORED_BYTES = 350 * 1024;
// A 2 MB upload can still declare a huge canvas (a "decompression bomb"); 40 megapixels covers every phone camera.
const MAX_INPUT_PIXELS = 40_000_000;
const QUALITIES = [80, 72, 64, 56, 48];

const open = (input: Buffer) => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
  // Turned upright from the EXIF orientation; the output carries no metadata (camera, GPS position…).
  .rotate()
  .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true });

/** An uploaded JPEG/PNG/WebP as the WebP the storefront serves. Throws when the bytes are not a readable image. */
export async function compressUpload(input: Buffer): Promise<Buffer> {
  const image = open(input);
  let output = Buffer.alloc(0);
  for (const quality of QUALITIES) {
    output = await image.clone().webp({ quality, effort: 5, smartSubsample: true }).toBuffer();
    if (output.length <= MAX_STORED_BYTES) break;
  }
  return output;
}

/** A file stored before uploads were compressed, re-encoded in its own format so its address (and every product that
 * uses it) stays the same. Returns the original when re-encoding would not make it smaller. */
export async function recompressStored(input: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<Buffer> {
  const image = open(input);
  let output = input;
  // A PNG becomes a 256-colour palette image (lossy like pngquant); lower quality settings hardly shrink it further.
  for (const quality of extension === 'png' ? [QUALITIES[0]] : QUALITIES) {
    const encoded = extension === 'jpg' ? image.clone().jpeg({ quality, mozjpeg: true })
      : extension === 'png' ? image.clone().png({ palette: true, quality, effort: 4, compressionLevel: 9 })
        : image.clone().webp({ quality, effort: 5, smartSubsample: true });
    output = await encoded.toBuffer();
    if (output.length <= MAX_STORED_BYTES) break;
  }
  return output.length < input.length ? output : input;
}
