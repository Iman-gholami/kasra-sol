import Image from 'next/image';
import Link from 'next/link';
import { categories } from '@/data/facets';
import { studioPhotos } from '@/data/products';

/** The collections as story-style circles: a studio portrait inside a Kasra-red ring, the name below.
 * Under the home cover and on the empty search page. The list is the caller's to label (wrap it in a nav). */
export function CollectionCircles() {
  const demoPrefetch = process.env.BACKEND_INTERNAL_URL ? undefined : true;
  return <ul className="collection-circles">
    {categories.map(category => <li key={category.slug}>
      <Link href={'/category/' + category.slug} prefetch={demoPrefetch}>
        <span className="collection-circle" aria-hidden="true">
          <span><Image src={studioPhotos.portraits[category.slug]} alt="" fill sizes="(max-width: 600px) 96px, 132px"/></span>
        </span>
        {category.title}
      </Link>
    </li>)}
  </ul>;
}
