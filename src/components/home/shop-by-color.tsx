'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Info } from 'lucide-react';
import { ProductGrid } from '@/components/products/product-grid';
import { formatNumber } from '@/lib/format';
import type { ShopByColorResult } from '@/lib/shop-by-color';

export function ShopByColor({ options }: { options: ShopByColorResult[] }) {
  const initial = options.find(option => option.color.slug === 'cream') ?? options[0];
  const [selected, setSelected] = useState(initial?.color.slug ?? '');
  const active = options.find(option => option.color.slug === selected) ?? initial;

  if (!active) return null;

  return <section className="container shop-by-color section-block" aria-labelledby="shop-by-color-title">
    <div className="shop-color-heading">
      <p className="section-kicker">استایل به سبک شما</p>
      <h2 id="shop-by-color-title">خرید بر اساس رنگ</h2>
      <p>رنگ موردعلاقه‌ات رو انتخاب کن و لباس‌های هماهنگ رو ببین.</p>
    </div>

    <div className="shop-color-scroll" role="group" aria-label="انتخاب رنگ لباس">
      <div className="shop-color-choices">
        {options.map(option => {
          const isSelected = active.color.slug === option.color.slug;
          return <button type="button" key={option.color.slug}
            className={'shop-color-choice' + (isSelected ? ' is-selected' : '')} aria-pressed={isSelected}
            aria-label={'نمایش محصولات رنگ ' + option.color.name} onClick={() => setSelected(option.color.slug)}>
            <span className="shop-color-swatch" style={{ backgroundColor: option.color.hex }} aria-hidden="true">
              {isSelected && <Check size={14} strokeWidth={2.5}/>}
            </span>
            <span>{option.color.name}</span>
          </button>;
        })}
      </div>
    </div>

    <div className="shop-color-result-summary" role="status" aria-live="polite" aria-atomic="true">
      <span>رنگ انتخاب‌شده: <strong>{active.color.name}</strong></span>
      <span>{formatNumber(active.count)} محصول در {process.env.NEXT_PUBLIC_BACKEND_ENABLED === 'true' ? 'کاتالوگ' : 'کاتالوگ نمایشی'}</span>
    </div>

    {active.products.length
      ? <div className="shop-color-product-grid"><ProductGrid products={active.products}/></div>
      : <div className="empty-state shop-color-empty">
        <h3>فعلاً محصولی با این رنگ نداریم</h3>
        <p>رنگ دیگه‌ای رو انتخاب کن یا همه محصولات رو ببین.</p>
      </div>}

    <div className="shop-color-footer">
      <Link className="btn btn-primary shop-color-view-all" href={'/shop?color=' + encodeURIComponent(active.color.slug)}>
        مشاهده همه محصولات این رنگ <ArrowLeft size={18} aria-hidden="true"/>
      </Link>
      <p><Info size={14} aria-hidden="true"/> عکس‌ها نمونه‌اند و الزاماً رنگ انتخاب‌شده لباس را نشان نمی‌دهند.</p>
    </div>
  </section>;
}
