// Pure classification rules for page-view statistics (no database, unit-tested).

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|curl|wget|python|node-fetch|axios|go-http|java\/|httpclient|monitor|uptime/i;
/** Crawlers, link previews, scripts and headless browsers are not visitors. */
export const isBot = (userAgent: string | undefined) => !userAgent || userAgent.length < 20 || BOT.test(userAgent);

export type Device = 'mobile' | 'tablet' | 'desktop';
export function deviceOf(userAgent: string): Device {
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(userAgent)) return 'tablet';
  if (/mobi|iphone|ipod|android|windows phone/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

const HIDDEN = /^\/(admin|api|_next)(\/|$)/;
/** The page path only: no query string or fragment (they can carry personal data), no back-office pages. */
export function normalizePath(raw: string): string | null {
  const path = raw.split(/[?#]/)[0].replace(/\/{2,}/g, '/');
  if (!path.startsWith('/') || path.length > 300 || HIDDEN.test(path)) return null;
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}
export function productSlugOf(path: string): string | null {
  const match = /^\/product\/([a-z0-9][a-z0-9-]{1,99})$/.exec(path);
  return match ? match[1] : null;
}

/** The referring site's host name only (never its path, which may identify a person). */
export function referrerHost(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.hostname.toLowerCase().replace(/^(www|m|l|lm)\./, '').slice(0, 120) || null;
  } catch { return null; }
}

export type Source = 'direct' | 'search' | 'social' | 'compare' | 'other';
const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|ecosia|baidu|qwant|brave|startpage|zarebin|parsijoo|gerdoo)\.[a-z.]+$/;
const SOCIAL = /(^|\.)(instagram\.com|facebook\.com|t\.me|telegram\.(org|me)|web\.telegram\.org|whatsapp\.com|wa\.me|x\.com|twitter\.com|t\.co|linkedin\.com|pinterest\.[a-z.]+|aparat\.com|eitaa\.com|rubika\.ir|ble\.ir|bale\.ai|igap\.net|youtube\.com|tiktok\.com|threads\.net)$/;
const COMPARE = /(^|\.)(torob\.com|emalls\.ir|digikala\.com|basalam\.com|divar\.ir)$/;
export function sourceOf(host: string | null): Source {
  if (!host) return 'direct';
  if (SEARCH.test(host)) return 'search';
  if (SOCIAL.test(host)) return 'social';
  if (COMPARE.test(host)) return 'compare';
  return 'other';
}
