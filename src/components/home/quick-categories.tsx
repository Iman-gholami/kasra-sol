import Image from 'next/image';
import Link from 'next/link';
import { categories } from '@/data/facets';
import { catalogHref } from '@/lib/catalog-url';

/** Homepage shortcuts under the search entry (phones). Built from the category config plus a "new arrivals"
 * entry pictured with the newest product's photo, so a new category adds a circle without code changes; once
 * the circles no longer fit, the row scrolls horizontally. Photos are decorative: each label names its link. */
export function QuickCategories({ newestPhoto }: { newestPhoto: string }) {
  const items = [
    ...categories.map(category => ({ key: category.slug, title: category.title, href: '/category/' + category.slug, photo: category.photo })),
    { key: 'newest', title: 'جدیدها', href: catalogHref('/shop', { sort: 'newest' }), photo: newestPhoto }
  ];
  return <nav className="quick-categories" aria-label="دسته‌بندی‌های سریع">
    <ul>
      {items.map(item => <li key={item.key}>
        <Link href={item.href} className="quick-category">
          <span className="quick-category-photo"><Image src={item.photo} alt="" width={72} height={72}/></span>
          <span className="quick-category-label">{item.title}</span>
        </Link>
      </li>)}
    </ul>
  </nav>;
}
