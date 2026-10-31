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
