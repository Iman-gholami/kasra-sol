'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { categories, palette } from '@/data/facets';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { editorialNumber } from '@/lib/format';

/** Stagger position for the opening reveal (see .menu-list-display in layout.css). */
const order = (i: number) => ({ '--i': i }) as CSSProperties;
const demoPrefetch = process.env.NEXT_PUBLIC_BACKEND_ENABLED === 'true' ? undefined : true;

/** Full-screen navigation for ≤ 1080px: slides from the inline-start edge, swipe toward that edge to close.
 * The collections are set large and numbered like a contents page. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const mounted = useMountedOnce(open);
  const pathname = usePathname();
  const close = () => setOpen(false);
  const current = (href: string) => (pathname === href ? 'page' as const : undefined);

  return <>
    <button type="button" className="icon-button menu-trigger" aria-label="باز کردن منو" aria-expanded={open}
      aria-controls="mobile-navigation" onClick={() => setOpen(true)}>
      <Menu size={23} aria-hidden="true"/>
    </button>
    {mounted && <Sheet open={open} onClose={close} id="mobile-navigation" className="sheet-start menu-sheet"
      labelledBy="mobile-menu-title" swipe="start">
      <div className="sheet-inner">
        <div className="sheet-header">
          <p className="sheet-title" id="mobile-menu-title">منوی کسری</p>
          <button type="button" className="icon-button" aria-label="بستن منو" onClick={close}><X size={22} aria-hidden="true"/></button>
        </div>
        <nav className="sheet-body menu-body" aria-label="منوی موبایل">
          <p className="menu-group-title">دسته‌بندی لباس زنانه</p>
          <ul className="menu-list menu-list-display">
            <li style={order(0)}><Link href="/shop" prefetch={demoPrefetch} aria-current={current('/shop')} onClick={close}>
              همه محصولات<ArrowLeft size={20} aria-hidden="true"/>
            </Link></li>
            {categories.map((item, i) => <li key={item.slug} style={order(i + 1)} className="mobile-category-group">
              {item.children.length ? <details className="mobile-category-details">
                <summary><span className="menu-no" aria-hidden="true">{editorialNumber(i + 1)}</span>{item.title}<span className="mobile-category-chevron" aria-hidden="true">⌄</span></summary>
                <ul className="mobile-category-children">
                  <li><Link href={'/category/' + item.slug} prefetch={false} onClick={close}>مشاهده همه {item.title}</Link></li>
                  {item.children.map(child => <li key={child.slug}><Link href={'/category/' + child.slug} prefetch={false} onClick={close}>{child.title}</Link></li>)}
                </ul>
              </details> : <Link href={'/category/' + item.slug} prefetch={false} aria-current={current('/category/' + item.slug)} onClick={close}>
                <span className="menu-no" aria-hidden="true">{editorialNumber(i + 1)}</span>{item.title}<ArrowLeft size={20} aria-hidden="true"/>
              </Link>}
            </li>)}
          </ul>
          <p className="menu-group-title">خرید بر اساس رنگ</p>
          <ul className="menu-colors">
            {palette.map(color => <li key={color.id}>
              <Link href={'/shop?color=' + color.id} onClick={close} className="chip">
                <span className="swatch-dot" style={{ backgroundColor: color.hex }} aria-hidden="true"/>{color.name}
              </Link>
            </li>)}
          </ul>
          <p className="menu-group-title">راهنمای خرید</p>
          <ul className="menu-list menu-list-quiet">
            <li><Link href="/size-guide" aria-current={current('/size-guide')} onClick={close}>راهنمای سایز</Link></li>
            <li><Link href="/shipping-and-returns" aria-current={current('/shipping-and-returns')} onClick={close}>ارسال و بازگشت (نمونه)</Link></li>
            <li><Link href="/faq" aria-current={current('/faq')} onClick={close}>سؤال‌های پرتکرار</Link></li>
            <li><Link href="/contact" aria-current={current('/contact')} onClick={close}>ارتباط با ما</Link></li>
          </ul>
          <p className="menu-group-title">کسری</p>
          <ul className="menu-list menu-list-quiet">
            <li><Link href="/wishlist" aria-current={current('/wishlist')} onClick={close}>علاقه‌مندی‌ها</Link></li>
            <li><Link href="/about" aria-current={current('/about')} onClick={close}>درباره کسری</Link></li>
            <li><Link href="/account" aria-current={current('/account')} onClick={close}>حساب کاربری (نمایشی)</Link></li>
          </ul>
        </nav>
      </div>
    </Sheet>}
  </>;
}
