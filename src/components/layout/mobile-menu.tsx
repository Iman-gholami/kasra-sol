'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { categories, palette } from '@/data/facets';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';

/** Navigation drawer for ≤ 820px: slides from the inline-start edge, swipe toward that edge to close. */
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
          <p className="menu-group-title">کالکشن‌ها</p>
          <ul className="menu-list">
            <li><Link href="/shop" aria-current={current('/shop')} onClick={close}>همه محصولات <ArrowLeft size={18} aria-hidden="true"/></Link></li>
            {categories.map(item => <li key={item.slug}>
              <Link href={'/category/' + item.slug} aria-current={current('/category/' + item.slug)} onClick={close}>
                {item.title} <ArrowLeft size={18} aria-hidden="true"/>
              </Link>
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
