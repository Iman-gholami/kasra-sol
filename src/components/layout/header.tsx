'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { categories } from '@/data/products';
import { useShop } from '@/components/shop-provider';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchButton = useRef<HTMLButtonElement>(null);
  const { cartCount, wishlist, hydrated } = useShop();

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (searchOpen) searchButton.current?.focus();
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  const closeNavigation = () => setMenuOpen(false);
  const closeSearch = () => { setSearchOpen(false); searchButton.current?.focus(); };

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

        {searchOpen && <div className="header-search-wrap" id="header-search">
          <div className="container header-search">
            <div className="search-topline"><span>جستجو در کالکشن کسری</span><button type="button" className="icon-button" aria-label="بستن جستجو" onClick={closeSearch}><X size={19}/></button></div>
            <form action="/search" role="search" className="search-line">
              <Search aria-hidden size={21}/><input ref={searchRef} type="search" name="q" placeholder="شومیز، مانتو، تیشرت..." aria-label="عبارت جستجو"/>
              <button className="btn btn-dark" type="submit">جستجو</button>
            </form>
            <div className="search-suggestions"><span>پیشنهادها</span>
              {categories.map(item => <Link key={item.slug} href={'/category/'+item.slug} onClick={closeSearch}>{item.title}</Link>)}
            </div>
          </div>
        </div>}

        {menuOpen && <>
          <button type="button" className="navigation-backdrop" aria-label="بستن منوی موبایل" onClick={closeNavigation}/>
          <nav id="mobile-navigation" className="mobile-menu" aria-label="منوی موبایل">
            <p className="mobile-menu-title">کالکشن‌ها <span>COLLECTIONS</span></p>
            <Link onClick={closeNavigation} href="/shop">همه محصولات</Link>
            {categories.map(item => <Link key={item.slug} onClick={closeNavigation} href={'/category/'+item.slug}>{item.title}</Link>)}
            <div className="mobile-menu-divider"/>
            <Link onClick={closeNavigation} href="/about">درباره کسری</Link>
            <Link onClick={closeNavigation} href="/account">حساب کاربری (نمایشی)</Link>
          </nav>
        </>}
      </header>
    </>
  );
}
