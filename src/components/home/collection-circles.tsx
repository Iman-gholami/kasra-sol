import Image from 'next/image';
import Link from 'next/link';
import { categories } from '@/data/facets';
import { demoPhotos } from '@/data/products';
import type { CategorySlug } from '@/types/store';

/** One model photo per collection: the circles below, and the sand rooms further down the home page. */
export const collectionPhotos: Record<CategorySlug, string> = {
  shomiz: demoPhotos.shomiz[1],
  manto: demoPhotos.manto[1],
  tshirt: demoPhotos.tshirt[1]
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
