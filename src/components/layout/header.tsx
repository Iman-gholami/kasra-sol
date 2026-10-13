'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { categories } from '@/data/facets';
import { SearchExperience } from '@/components/search/search-experience';
import { useShop } from '@/components/shop-provider';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButton = useRef<HTMLButtonElement>(null);
  const mobileNav = useRef<HTMLElement>(null);
  const { cartCount, wishlist, hydrated } = useShop();

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileNav.current?.querySelector<HTMLElement>('a')?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);
  const closeNavigation = () => setMenuOpen(false);
  function trapNav(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenuOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const links = mobileNav.current?.querySelectorAll<HTMLElement>('a[href]');
    if (!links?.length) return;
    if (event.shiftKey && document.activeElement === links[0]) {
      event.preventDefault(); links[links.length-1].focus();
    } else if (!event.shiftKey && document.activeElement === links[links.length-1]) {
      event.preventDefault(); links[0].focus();
    }
  }
  const closeSearch = () => { setSearchOpen(false); requestAnimationFrame(()=>searchButton.current?.focus()); };

  return (
    <>
      <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
      <div className="announcement">نمایش آزمایشی کسری بوتیک · پرداخت و ثبت سفارش واقعی فعال نیست</div>
      <header className="site-header">
        <div className="container header-inner">
          <div className="header-leading">
            <button type="button" className="icon-button mobile-only" aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'} aria-expanded={menuOpen} aria-controls="mobile-navigation"
              onClick={() => { setMenuOpen(!menuOpen); setSearchOpen(false); }}>
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
            <Link href="/" className="brand" aria-label="کسری بوتیک، صفحه اصلی" onClick={closeNavigation}>
              <span className="brand-monogram" aria-hidden="true">K</span>
              <span className="brand-type"><strong dir="ltr">KASRA</strong><small dir="ltr">B O U T I Q U E</small></span>
            </Link>
          </div>

          <nav className="desktop-nav" aria-label="دسته‌بندی‌های اصلی">
            <Link href="/shop">همه محصولات</Link>
            {categories.map(item => <Link key={item.slug} href={'/category/' + item.slug}>{item.title}</Link>)}
            <Link href="/about">درباره کسری</Link>
          </nav>

          <div className="header-actions">
            <button type="button" ref={searchButton} className="icon-button" aria-expanded={searchOpen} aria-controls="header-search" aria-label={searchOpen ? 'بستن جستجو' : 'جستجوی محصولات'}
              onClick={() => { setSearchOpen(!searchOpen); setMenuOpen(false); }}><Search size={21} /></button>
            <Link className="icon-button desktop-action" aria-label="حساب کاربری نمایشی" href="/account"><UserRound size={20} /></Link>
            <Link className="icon-button count-wrap" href="/wishlist" aria-label="علاقه‌مندی‌ها">
              <Heart size={21} />{hydrated && wishlist.length > 0 && <span className="count">{wishlist.length}</span>}
            </Link>
            <Link className="icon-button count-wrap" href="/cart" aria-label="سبد خرید">
              <ShoppingBag size={21} />{hydrated && cartCount > 0 && <span className="count">{cartCount}</span>}
            </Link>
          </div>
        </div>

        {menuOpen && <>
          <button type="button" className="navigation-backdrop" aria-label="بستن منوی موبایل" onClick={closeNavigation}/>
          <nav id="mobile-navigation" ref={mobileNav} onKeyDown={trapNav} className="mobile-menu" aria-label="منوی موبایل">
            <p className="mobile-menu-title">کالکشن‌ها <span>COLLECTIONS</span></p>
            <Link onClick={closeNavigation} href="/shop">همه محصولات</Link>
            {categories.map(item => <Link key={item.slug} onClick={closeNavigation} href={'/category/'+item.slug}>{item.title}</Link>)}
            <div className="mobile-menu-divider"/>
            <Link onClick={closeNavigation} href="/about">درباره کسری</Link>
            <Link onClick={closeNavigation} href="/account">حساب کاربری (نمایشی)</Link>
          </nav>
        </>}
      </header>
      {searchOpen && <SearchExperience onClose={closeSearch} />}
    </>
  );
}
