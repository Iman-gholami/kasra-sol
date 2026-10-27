import Image from 'next/image';
import Link from 'next/link';
import { categories } from '@/data/facets';
import { lookbookPhotos } from '@/data/products';
import type { CategorySlug } from '@/types/store';

/** One model photo per collection, for the circles and the home page's collection cards. */
export const collectionPhotos: Record<CategorySlug, string> = {
  shomiz: lookbookPhotos.shomizRose,
  manto: lookbookPhotos.mantoSage,
  tshirt: lookbookPhotos.tshirtBlue
};

/** The collections as story-style circles: a model on the studio sand inside an oxblood ring, the name below.
 * Under the home cover and on the empty search page. The list is the caller's to label (wrap it in a nav). */
export function CollectionCircles() {
  const demoPrefetch = process.env.BACKEND_INTERNAL_URL ? undefined : true;
  return <ul className="collection-circles">
    {categories.map(category => <li key={category.slug}>
      <Link href={'/category/' + category.slug} prefetch={demoPrefetch}>
        <span className="collection-circle" aria-hidden="true">
          <span><Image src={collectionPhotos[category.slug]} alt="" fill sizes="(max-width: 600px) 96px, 132px"/></span>
        </span>
        {category.title}
      </Link>
    </li>)}
  </ul>;
}
