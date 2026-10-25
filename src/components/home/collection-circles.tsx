import Image from 'next/image';
import Link from 'next/link';
import { allCategories } from '@/data/facets';

/** One model photo per collection: the circles below, and the sand rooms further down the home page. */
export const featuredCollections = [
  { slug: 'shomiz', title: 'شومیز', description: 'جزئیات ظریف برای استایل روزمره', photo: '/images/lookbook/shomiz-rose.avif' },
  { slug: 'manto', title: 'مانتو زنانه', description: 'لایه‌های راحت، خوش‌فرم و امروزی', photo: '/images/lookbook/manto-sage.avif' },
  { slug: 'tshirt', title: 'تیشرت زنانه', description: 'انتخاب‌های ساده برای هر روز', photo: '/images/lookbook/tshirt-blue.avif' }
] as const;
// These three categories have verified DEMO photography; other category links are text-only.
export const featuredSlugs = featuredCollections.map(item => item.slug);
export const visibleFeaturedCollections = featuredCollections.filter(item =>
  allCategories.some(category => category.slug === item.slug));

/** The collections as story-style circles: a model on the studio sand inside an oxblood ring, the name below.
 * Under the home cover and on the empty search page. The list is the caller's to label (wrap it in a nav). */
export function CollectionCircles() {
  const demoPrefetch = process.env.BACKEND_INTERNAL_URL ? undefined : true;
  return <ul className="collection-circles">
    {visibleFeaturedCollections.map(category => <li key={category.slug}>
      <Link href={'/category/' + category.slug} prefetch={demoPrefetch}>
        <span className="collection-circle" aria-hidden="true">
          <span><Image src={category.photo} alt="" fill sizes="(max-width: 600px) 96px, 132px"/></span>
        </span>
        {category.title}
      </Link>
    </li>)}
  </ul>;
}
