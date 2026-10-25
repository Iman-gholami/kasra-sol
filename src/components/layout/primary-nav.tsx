'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { categories, palette } from '@/data/facets';

const OPEN_DELAY = 150;
const CLOSE_DELAY = 250;
// Only prefetch entire dynamic catalog pages in the backend-free demo;
// live stock must continue to be requested on navigation.
const demoPrefetch = process.env.NEXT_PUBLIC_BACKEND_ENABLED === 'true' ? undefined : true;

/** Desktop navigation (≥ 1081px). "همه محصولات" stays a direct link; the adjacent toggle opens a
 * disclosure panel (WAI-ARIA disclosure navigation pattern, not a menu role). */
export function PrimaryNav() {
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [openedFor, setOpenedFor] = useState(pathname);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const finePointer = useRef(false);

  // Close the panel whenever the route changes (adjusting state during render, not in an effect).
  if (openedFor !== pathname) { setOpenedFor(pathname); if (open) setOpen(false); }

  useEffect(() => {
    finePointer.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    return () => window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocumentKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !toggle.current?.parentElement?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onDocumentKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onDocumentKey); document.removeEventListener('pointerdown', onPointer); };
  }, [open]);

  // Closing must also cancel a pending hover-intent timer, or a click inside the panel reopens it.
  function close() { window.clearTimeout(timer.current); setOpen(false); }

  function schedule(next: boolean) {
    if (!finePointer.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(next), next ? OPEN_DELAY : CLOSE_DELAY);
  }

  function onToggleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('a')?.focus());
    }
  }

  function onPanelKey(event: KeyboardEvent<HTMLDivElement>) {
    const links = [...(panel.current?.querySelectorAll<HTMLElement>('a') ?? [])];
    const index = links.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? (index + 1) % links.length : (index - 1 + links.length) % links.length;
      links[next]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      links[event.key === 'Home' ? 0 : links.length - 1]?.focus();
    }
  }

  const current = (href: string) =>
    href === '/shop' ? pathname === '/shop' : pathname === href || pathname.startsWith(href + '/');

  return <nav className="desktop-nav" aria-label="دسته‌بندی‌های اصلی"
    onBlur={event => { if (open && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <ul>
      <li className="nav-shop" onPointerEnter={() => schedule(true)} onPointerLeave={() => schedule(false)}>
        <Link href="/shop" prefetch={demoPrefetch} aria-current={current('/shop') ? 'page' : undefined}>همه محصولات</Link>
        <button ref={toggle} type="button" className="nav-toggle" aria-expanded={open} aria-controls={panelId}
          aria-label="نمایش همه دسته‌بندی‌های فروشگاه" onClick={() => { window.clearTimeout(timer.current); setOpen(value => !value); }}
          onKeyDown={onToggleKey}>
          <ChevronDown size={16} aria-hidden="true"/>
        </button>
        <div id={panelId} ref={panel} className="nav-panel" hidden={!open} onKeyDown={onPanelKey}>
          {open && <div className="container nav-panel-inner">
            <div className="nav-panel-categories">
              <p className="nav-panel-title">دسته‌بندی لباس زنانه</p>
              <ul>
                {categories.map(category => <li key={category.slug} className="nav-category-group">
                  <Link href={'/category/' + category.slug} prefetch={demoPrefetch} className="nav-category-parent" onClick={close}>{category.title}</Link>
                  {category.children.length > 0 && <ul className="nav-category-children">
                    {category.children.map(child => <li key={child.slug}>
                      <Link href={'/category/' + child.slug} prefetch={demoPrefetch} onClick={close}>{child.title}</Link>
                    </li>)}
                  </ul>}
                </li>)}
              </ul>
            </div>
            <div className="nav-panel-colors">
              <p className="nav-panel-title">خرید بر اساس رنگ</p>
              <ul>
                {palette.map(color => <li key={color.id}>
                  <Link href={'/shop?color=' + color.id} onClick={close}>
                    <span className="swatch-dot" style={{ backgroundColor: color.hex }} aria-hidden="true"/>{color.name}
                  </Link>
                </li>)}
              </ul>
            </div>
            <div className="nav-panel-links">
              <p className="nav-panel-title">میان‌بُرها</p>
              <ul>
                <li><Link href="/shop?sort=newest" onClick={close}>تازه‌ترین‌ها</Link></li>
                <li><Link href="/shop?sale=1" onClick={close}>تخفیف‌دارها</Link></li>
                <li><Link href="/shop?stock=1" onClick={close}>فقط موجودها</Link></li>
                <li><Link href="/size-guide" onClick={close}>راهنمای سایز</Link></li>
              </ul>
              <Link href="/shop" className="text-link" onClick={close}>دیدن همه محصولات <ArrowLeft size={16} aria-hidden="true"/></Link>
            </div>
          </div>}
        </div>
      </li>
      {categories.filter(item => ['pants', 'manto', 'shomiz-vest'].includes(item.slug)).map(item => <li key={item.slug}>
        <Link href={'/category/' + item.slug} prefetch={demoPrefetch} aria-current={current('/category/' + item.slug) ? 'page' : undefined}>{item.title}</Link>
      </li>)}
      <li><Link href="/about" aria-current={current('/about') ? 'page' : undefined}>درباره کسری</Link></li>
    </ul>
  </nav>;
}
