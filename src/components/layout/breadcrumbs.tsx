import Link from 'next/link';

type Crumb = { label: string; href?: string };

/** Breadcrumb trail: separators are CSS-only (hidden from assistive tech), last item is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return <nav className="breadcrumbs" aria-label="مسیر صفحه">
    <ol>
      {items.map((item, index) => <li key={item.label + index}>
        {item.href && index < items.length - 1
          ? <Link href={item.href}>{item.label}</Link>
          : <span aria-current="page">{item.label}</span>}
      </li>)}
    </ol>
  </nav>;
}
