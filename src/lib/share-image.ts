/** Link previews in messengers (Telegram, Bale, WhatsApp…) need a JPEG: not all of them show the AVIF and WebP photos
 * the storefront serves. Every photo therefore has a 1200×630 JPEG share image, found by its address. */
export const SHARE_SIZE = { width: 1200, height: 630 } as const;

/** The home page card, and the fallback for any page without its own share image (scripts/share-images.ts). */
export const HOME_SHARE_IMAGE = '/images/share/kasra-boutique.jpg';

/** The JPEG (or PNG) share image of a product photo, or undefined when it has none. `card` is true for the 1200×630 ones.
 * - uploads (`/api/media/<id>.webp`): the API stores `<id>.jpg` next to each one;
 * - uploads stored before WebP (`.jpg`/`.png`): the photo itself, a format every messenger shows (size unknown);
 * - committed demo photos (`/images/<folder>/<name>.avif`): `/images/share/<folder>-<name>.jpg`. */
export function shareImageFor(src: string | undefined): { url: string; card: boolean } | undefined {
  if (!src) return undefined;
  const upload = /^\/api\/media\/([0-9a-f-]{36})\.(webp|jpg|png)$/.exec(src);
  if (upload) return upload[2] === 'webp' ? { url: '/api/media/' + upload[1] + '.jpg', card: true } : { url: src, card: false };
  const committed = /^\/images\/([a-z-]+)\/([a-z0-9-]+)\.avif$/.exec(src);
  return committed ? { url: '/images/share/' + committed[1] + '-' + committed[2] + '.jpg', card: true } : undefined;
}
