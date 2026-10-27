'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { ProductRail } from '@/components/products/product-rail';
import { SectionHeading } from '@/components/home/section-heading';
import { formatNumber } from '@/lib/format';
import type { ShopByColorResult } from '@/lib/shop-by-color';

/** Shop by colour: a row of colour pills (scrolls on phones) and a row of four matching products; the heading's link
 * opens the catalog filtered by the chosen colour. Choosing a colour changes the products in place (no navigation). */
export function ShopByColor({ options }: { options: ShopByColorResult[] }) {
  const initial = options.find(option => option.color.slug === 'cream') ?? options[0];
  const [selected, setSelected] = useState(initial?.color.slug ?? '');
  const active = options.find(option => option.color.slug === selected) ?? initial;

  if (!active) return null;

  return <section className="container home-section shop-by-color" aria-labelledby="shop-by-color-title">
    <SectionHeading id="shop-by-color-title" title="خرید بر اساس رنگ" note="رنگ موردعلاقه‌ات را انتخاب کن و لباس‌های هم‌رنگ را ببین."
      href={'/shop?color=' + encodeURIComponent(active.color.slug)} linkLabel="مشاهده‌ی همه" linkName="مشاهده‌ی همه‌ی محصولات این رنگ"/>

    <div className="shop-color-scroll" role="group" aria-label="انتخاب رنگ لباس">
      <div className="shop-color-choices">
        {options.map(option => {
          const isSelected = active.color.slug === option.color.slug;
          return <button type="button" key={option.color.slug}
            className={'shop-color-choice' + (isSelected ? ' is-selected' : '')} aria-pressed={isSelected}
            aria-label={'نمایش محصولات رنگ ' + option.color.name} onClick={() => setSelected(option.color.slug)}>
            <span className="shop-color-swatch" style={{ backgroundColor: option.color.hex }} aria-hidden="true">
              {isSelected && <Check size={13} strokeWidth={2.5}/>}
            </span>
            <span>{option.color.name}</span>
          </button>;
        })}
      </div>
    </div>

    <p className="shop-color-result-summary" role="status" aria-live="polite" aria-atomic="true">
      <span><strong>{active.color.name}</strong> · {formatNumber(active.count)} محصول</span>
      <span>عکس‌ها نمونه‌اند و الزاماً رنگ انتخاب‌شده را نشان نمی‌دهند.</span>
    </p>

    {active.products.length
      ? <ProductRail products={active.products} label={'محصولات رنگ ' + active.color.name}/>
      : <div className="empty-state shop-color-empty">
        <h3>فعلاً محصولی با این رنگ نداریم</h3>
        <p>رنگ دیگری را انتخاب کن یا همه‌ی محصولات را ببین.</p>
      </div>}
  </section>;
}
