import type { MetadataRoute } from 'next';
import { indexingEnabled, PRIVATE_PATHS, siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Closed until launch (src/lib/seo.ts): the same switch sets every page's robots meta tag.
  if (!indexingEnabled()) return { rules: { userAgent: '*', disallow: '/' } };
  // Product photos live under /api/media/: the longer Allow rule keeps them crawlable (image search, product results).
  return { rules: { userAgent: '*', allow: ['/', '/api/media/'], disallow: PRIVATE_PATHS }, sitemap: siteUrl() + '/sitemap.xml' };
}
