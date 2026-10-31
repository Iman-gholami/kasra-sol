import type { Metadata } from 'next';
import { HOME_SHARE_IMAGE, SHARE_SIZE } from '@/lib/share-image';

/** Settings read from the environment (a plain object in tests). */
type Env = Record<string, string | undefined>;

/** The build's settings, written into the code by next.config.ts `env`, so prerendered pages (and robots.txt) and pages
 * rendered per request agree whatever the server's runtime environment says. Outside a Next.js build (unit tests)
 * the NEXT_PUBLIC_* variables are read directly. */
const built = (): Env => ({
  NEXT_PUBLIC_SITE_URL: process.env.KASRA_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SITE_INDEXABLE: process.env.KASRA_SITE_INDEXABLE ?? process.env.NEXT_PUBLIC_SITE_INDEXABLE
});

/** The public address of the storefront, without a trailing slash (canonical URLs, sitemap, share links). */
export function siteUrl(env: Env = built()) {
  return (env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

/** The one switch that opens the store to search engines: robots.txt, every page's robots meta tag and the sitemap
 * reference follow it together, so they can never disagree. Set at build time (repository variable SITE_INDEXABLE →
 * build argument NEXT_PUBLIC_SITE_INDEXABLE). Only a domain served over HTTPS can be opened: never the server's IP
 * address or a local copy. */
export function indexingEnabled(env: Env = built()) {
  if (env.NEXT_PUBLIC_SITE_INDEXABLE !== 'true') return false;
  try {
    const { protocol, hostname } = new URL(env.NEXT_PUBLIC_SITE_URL ?? '');
    return protocol === 'https:' && hostname.includes('.') && !/^[\d.]+$/.test(hostname) && !hostname.startsWith('[');
  } catch { return false; }
}

/** The robots meta tag of every page that does not set its own (private pages always say noindex). */
export const robotsMeta = (env: Env = built()) =>
  indexingEnabled(env) ? { index: true, follow: true } : { index: false, follow: false };

/** Pages that are never worth indexing, whatever the switch says: personal, transactional or endless (search). */
export const PRIVATE_PATHS = ['/admin', '/api/', '/cart', '/checkout', '/account', '/wishlist', '/order-confirmation', '/search'];

export const SITE_NAME = 'کسری بوتیک';
/** What a shared link to the home page says (the card itself is HOME_SHARE_IMAGE). */
export const HOME_SHARE = {
  title: 'کسری بوتیک | استایل هر روزت، به سبک خودت',
  description: 'شومیز، مانتو و تیشرت زنانه با طراحی مینیمال؛ انتخاب‌های ساده برای استایل هر روزت.'
};

type ShareImage = { url: string; width?: number; height?: number; alt?: string };

/** The canonical address and the link-preview tags of a main page. Next.js does not merge a page's `openGraph` with the
 * layout's, so every page gets the complete set; relative addresses resolve against the build's site URL. Filters and
 * sorting in the query string share the canonical address of the page without them. */
export function pageMetadata({ path, title, description = HOME_SHARE.description, image }:
  { path: string; title: string; description?: string; image?: ShareImage }): Metadata {
  const images = [image ?? { url: HOME_SHARE_IMAGE, ...SHARE_SIZE, alt: SITE_NAME }];
  return {
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'fa_IR', url: path, title, description, images },
    twitter: { card: 'summary_large_image', title, description, images: images.map(({ url, alt }) => ({ url, alt })) }
  };
}
