'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { categories } from '@/data/products';
import { useShop } from '@/components/shop-provider';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { cartCount, wishlist, hydrated } = useShop();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); setSearchOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
      <div className="announcement">نسخه نمایشی کسری بوتیک — سفارش و پرداخت واقعی انجام نمی‌شود</div>
      <header className="site-header">
        <div className="container header-inner">
          <div className="header-leading">
            <button className="icon-button mobile-only" aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <Link href="/" className="brand" onClick={() => setMenuOpen(false)} aria-label="کسری بوتیک، صفحه اصلی">
              <span className="brand-mark">K</span><span><strong>کسری</strong><small>KASRA BOUTIQUE</small></span>
            </Link>
          </div>
          <nav className="desktop-nav" aria-label="دسته‌بندی‌های اصلی">
            <Link href="/shop">همه محصولات</Link>
            {categories.map((item) => <Link key={item.slug} href={'/category/' + item.slug}>{item.title}</Link>)}
            <Link href="/about">درباره ما</Link>
          </nav>
          <div className="header-actions">
            <button className="icon-button" aria-expanded={searchOpen} aria-label="جستجوی محصولات" onClick={() => setSearchOpen(!searchOpen)}>
              <Search size={21} />
            </button>
            <Link className="icon-button desktop-action" aria-label="حساب نمایشی" href="/account"><UserRound size={21} /></Link>
            <Link className="icon-button count-wrap" href="/wishlist" aria-label="علاقه‌مندی‌ها">
              <Heart size={21} />{hydrated && wishlist.length > 0 && <span className="count">{wishlist.length}</span>}
            </Link>
            <Link className="icon-button count-wrap" href="/cart" aria-label="سبد خرید">
              <ShoppingBag size={21} />{hydrated && cartCount > 0 && <span className="count">{cartCount}</span>}
            </Link>
          </div>
        </div>
        {searchOpen && (
          <div className="header-search container">
            <form action="/search" role="search" className="search-line">
              <Search aria-hidden size={20} />
              <input autoFocus type="search" name="q" placeholder="دنبال چه لباسی می‌گردی؟" aria-label="عبارت جستجو" />
              <button className="btn btn-dark" type="submit">جستجو</button>
            </form>
            <p className="muted small">پیشنهاد: <Link href="/category/shomiz" onClick={() => setSearchOpen(false)}>شومیز</Link> · <Link href="/category/manto" onClick={() => setSearchOpen(false)}>مانتو</Link></p>
          </div>
        )}
        {menuOpen && <nav className="mobile-menu container" aria-label="منوی موبایل">
          <Link onClick={() => setMenuOpen(false)} href="/shop">همه محصولات</Link>
          {categories.map((item) => <Link key={item.slug} onClick={() => setMenuOpen(false)} href={'/category/' + item.slug}>{item.title}</Link>)}
          <Link onClick={() => setMenuOpen(false)} href="/about">درباره ما</Link>
          <Link onClick={() => setMenuOpen(false)} href="/account">حساب کاربری (نمایشی)</Link>
        </nav>}
      </header>
    </>
  );
}
