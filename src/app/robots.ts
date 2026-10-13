import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  // Entire mock storefront is non-indexable until launch and real business details are published.
  return { rules: { userAgent: '*', disallow: '/' } };
}
