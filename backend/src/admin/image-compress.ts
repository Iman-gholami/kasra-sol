import sharp, { type Sharp } from 'sharp';

/** The storefront serves photos as they are stored (next.config.ts `images.unoptimized`, no /_next/image resizing),
 * so every stored photo is already sized for the largest place it appears: a phone-width column at 3× density. */
export const MAX_WIDTH = 1200;
export const MAX_HEIGHT = 1600;
/** No stored photo is larger than this: the quality steps down, then the size, until it fits. */
export const MAX_STORED_BYTES = 350 * 1024;
// A 2 MB upload can still declare a huge canvas (a "decompression bomb"); 40 megapixels covers every phone camera.
const MAX_INPUT_PIXELS = 40_000_000;
const QUALITIES = [80, 72, 64, 56, 48];

type Encoder = (image: Sharp, quality: number) => Sharp;
const webp: Encoder = (image, quality) => image.webp({ quality, effort: 5, smartSubsample: true });

// Images with small defects (a bad checksum) are decoded the way browsers show them; bytes that are no image still fail.
const open = (input: Buffer, width = MAX_WIDTH, height = MAX_HEIGHT) =>
  sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'none' })
    // Turned upright from the EXIF orientation; the output carries no metadata (camera, GPS position…).
    .rotate()
    .resize({ width, height, fit: 'inside', withoutEnlargement: true });

/** Encodes at falling quality until the bytes fit MAX_STORED_BYTES. A very grainy photo can stay too large at any
 * quality; it is then made smaller, in proportion to the excess, until it fits. */
async function withinBudget(input: Buffer, encode: Encoder, qualities = QUALITIES): Promise<Buffer> {
  let output = Buffer.alloc(0);
  for (const quality of qualities) {
    output = await encode(open(input), quality).toBuffer();
    if (output.length <= MAX_STORED_BYTES) return output;
  }
  let { width = MAX_WIDTH, height = MAX_HEIGHT } = await sharp(output).metadata();
  for (let attempt = 0; attempt < 4 && output.length > MAX_STORED_BYTES; attempt++) {
    // Bytes grow with the pixel count: scale both sides by the square root of the excess, with a margin.
    const scale = Math.sqrt(MAX_STORED_BYTES / output.length) * 0.9;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    output = await encode(open(input, width, height), qualities.at(-1)!).toBuffer();
  }
  return output;
}

/** An uploaded JPEG/PNG/WebP as the WebP the storefront serves. Throws when the bytes are not a readable image. */
export function compressUpload(input: Buffer): Promise<Buffer> {
  return withinBudget(input, webp);
}

/** A file stored before uploads were compressed, re-encoded in its own format so its address (and every product that
 * uses it) stays the same. Returns the original when re-encoding would not make it smaller. */
export async function recompressStored(input: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<Buffer> {
  const output = extension === 'jpg' ? await withinBudget(input, (image, quality) => image.jpeg({ quality, mozjpeg: true }))
    // A PNG becomes a 256-colour palette image (lossy like pngquant); lower quality settings hardly shrink it further.
    : extension === 'png' ? await withinBudget(input, (image, quality) =>
      image.png({ palette: true, quality, effort: 4, compressionLevel: 9 }), [QUALITIES[0]])
      : await withinBudget(input, webp);
  return output.length < input.length ? output : input;
}

/** Link previews (Telegram, Bale, WhatsApp…): 1200×630, the size every messenger shows large. */
export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;
/** WhatsApp drops preview images above about 300 KB. */
export const MAX_SHARE_BYTES = 280 * 1024;
// The storefront's studio gray (--color-studio), so a photo and its share image look like the product page.
const STUDIO = '#EAECF0';

/** The photo as a JPEG link preview: whole (never cropped) and centred on the studio gray. Messengers show JPEG
 * everywhere, unlike the WebP/AVIF the storefront serves. */
export async function shareImage(input: Buffer): Promise<Buffer> {
  const photo = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'none' }).rotate()
    .resize({ width: SHARE_WIDTH, height: SHARE_HEIGHT, fit: 'contain', background: STUDIO })
    .flatten({ background: STUDIO }).toBuffer();
  let output = Buffer.alloc(0);
  for (const quality of QUALITIES) {
    output = await sharp(photo).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (output.length <= MAX_SHARE_BYTES) break;
  }
  return output;
}
