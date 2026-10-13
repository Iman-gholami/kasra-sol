'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Heart, Ruler, ShoppingBag, X } from 'lucide-react';
import { getVariant } from '@/data/products';
import { useShop } from '@/components/shop-provider';
import { discountPercent, formatPercent, toman } from '@/lib/format';
import type { Product } from '@/types/store';

export function ProductDetail({ product }: { product: Product }) {
  const { addToCart, openCart, wishlist, toggleWishlist, hydrated } = useShop();
  const [imageIndex, setImageIndex] = useState(0);
  const [colorId, setColorId] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const zoom = useRef<HTMLDialogElement>(null);
  const guide = useRef<HTMLDialogElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const color = product.colors.find((entry) => entry.id === colorId);
  const variant = getVariant(product, colorId, size);
  const discount = discountPercent(product.price, product.compareAt);
  const isFavorite = hydrated && wishlist.includes(product.id);
  useEffect(() => {
    if (notice?.error) feedback.current?.focus();
  }, [notice]);
  const needsSelection = !colorId || !size;

  function chooseColor(id: string) {
    setColorId(id);
    if (size && !(getVariant(product, id, size)?.stock)) setSize('');
    setQuantity(1);
    setNotice(null);
  }
  function add() {
    if (!colorId || !size) {
      setNotice({ text: 'لطفاً رنگ و سایز موردنظر را انتخاب کن.', error: true });
      return;
    }
    if (!variant || variant.stock < quantity) {
      setNotice({ text: 'این ترکیب فعلاً موجود نیست یا تعداد انتخاب‌شده بیش از موجودی است.', error: true });
      return;
    }
    const success = addToCart({ productId: product.id, colorId, size, quantity });
    setNotice({ text: success ? 'انتخابت به سبد نمایشی اضافه شد.' : 'افزودن به سبد خرید ممکن نیست.', error: !success });
    if (success) openCart();
  }
  return <div className="detail-layout">
    <div>
      <button className="gallery-main" type="button" onClick={() => zoom.current?.showModal()} aria-label="بزرگ‌نمایی تصویر محصول">
        <Image src={product.images[imageIndex]} alt={'عکس نمایشی ساخته‌شده با هوش مصنوعی ' + product.name} fill priority sizes="(max-width: 600px) 100vw, 50vw" />
      </button>
      <div className="gallery-thumbs">{product.images.map((image, index) =>
        <button key={image} className={'gallery-thumb' + (index === imageIndex ? ' selected' : '')} onClick={() => setImageIndex(index)} type="button" aria-label={'نمایش تصویر ' + (index + 1)} aria-pressed={index === imageIndex}>
          <Image src={image} alt="" fill sizes="80px" />
        </button>)}</div>
      <dialog ref={zoom} className="zoom-dialog" aria-label="نمای بزرگ محصول" onClick={(event) => { if (event.target === zoom.current) zoom.current?.close(); }}>
        <button type="button" className="close-zoom" onClick={() => zoom.current?.close()} aria-label="بستن بزرگ‌نمایی"><X size={23} /></button>
        <div className="zoom-image"><Image src={product.images[imageIndex]} alt={'نمای بزرگ ' + product.name} fill sizes="(max-width: 650px) 90vw, 600px" /></div>
      </dialog>
    </div>
    <div className="detail-copy">
      <p className="eyebrow">KASRA / EVERYDAY COLLECTION</p>
      <h1>{product.name}</h1>
      <div className="detail-price"><div className="price-line"><strong>{toman(product.price)}</strong>{product.compareAt && <del>{toman(product.compareAt)}</del>}</div>{discount > 0 && <p className="sale">{formatPercent(discount)} تخفیف نمایشی</p>}</div>
      <p className="detail-desc">{product.description}</p>
      <p className="status-message" style={{ marginBottom: 24 }}>تصاویر مدل با هوش مصنوعی ساخته شده‌اند و صرفاً برای بررسی طراحی فروشگاه هستند؛ ممکن است با نام، رنگ یا جزئیات دقیق محصول یکسان نباشند.</p>
      <div className="variant-group">
        <div className="variant-label">رنگ <span>{color ? '— ' + color.name : '— انتخاب کن'}</span></div>
        <div className="swatch-list">{product.colors.map((entry) => {
          const available = product.variants.some((v) => v.colorId === entry.id && v.stock > 0);
          return <button key={entry.id} type="button" disabled={!available} className={'swatch' + (colorId === entry.id ? ' selected' : '') + (!available ? ' unavailable' : '')}
            title={entry.name} aria-label={'رنگ ' + entry.name + (!available ? ' ناموجود' : '')} aria-pressed={colorId === entry.id} onClick={() => chooseColor(entry.id)}>
            <span style={{ backgroundColor: entry.hex }} /></button>;
        })}</div>
      </div>
      <div className="variant-group">
        <div className="variant-label">سایز <span>— {size || 'انتخاب کن'}</span> <button type="button" className="size-guide-trigger" onClick={() => guide.current?.showModal()}><Ruler size={16}/> راهنمای سایز</button></div>
        <div className="size-list" dir="ltr">{product.sizes.map((entry) => {
          const available = colorId ? Boolean(getVariant(product, colorId, entry)?.stock) :
            product.variants.some((v) => v.size === entry && v.stock > 0);
          return <button key={entry} type="button" disabled={!available} className={'size-option' + (size === entry ? ' selected' : '')}
            aria-pressed={size === entry} aria-label={'سایز ' + entry + (available ? '' : ' ناموجود')} onClick={() => { setSize(entry); setQuantity(1); setNotice(null); }}>{entry}</button>;
        })}</div>
      </div>
      <div className="quantity-row"><span>تعداد {variant && variant.stock > 0 ? '· موجودی نمونه: ' + variant.stock.toLocaleString('fa-IR') : ''}</span>
        <div className="qty-stepper"><button type="button" aria-label="افزایش تعداد" disabled={!variant?.stock || quantity >= variant.stock} onClick={() => setQuantity((q) => q + 1)}>+</button><span>{quantity.toLocaleString('fa-IR')}</span><button type="button" aria-label="کاهش تعداد" disabled={quantity < 2} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button></div>
      </div>
      {notice && <p ref={feedback} tabIndex={-1} role={notice.error ? 'alert' : 'status'} className={'status-message purchase-feedback'+(notice.error?' error':'')}>
        {notice.error ? null : <Check size={18} aria-hidden="true"/>}{notice.text} {!notice.error && <Link className="subtle-link" href="/cart">مشاهده سبد</Link>}
      </p>}
      <div className="purchase-row"><button type="button" className="btn btn-dark" onClick={add}>
        <ShoppingBag size={18} /> {needsSelection ? 'رنگ و سایز رو انتخاب کن' : 'افزودن به سبد خرید'}</button>
        <button type="button" className="btn btn-outline" aria-label={isFavorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'} aria-pressed={isFavorite} onClick={() => toggleWishlist(product.id)}>
          <Heart size={19} fill={isFavorite ? 'currentColor' : 'none'} /></button>
      </div>
      <p className="purchase-assurance">انتخاب رنگ و سایز برای بررسی موجودی نمایشی لازم است.</p>
      <div className="detail-extras">
        <details open><summary>مشخصات و نگهداری</summary><p>جنس: {product.material} · فرم لباس: {product.fit}</p><p>{product.care}</p></details>
        <details><summary>ارسال و بازگشت</summary><p>شرایط ارسال و بازگشت هنوز تعیین نشده است. <Link className="subtle-link" href="/shipping-and-returns">مشاهده توضیحات نمونه</Link></p></details>
      </div>
    </div>
    <dialog ref={guide} className="size-guide-dialog" aria-label="راهنمای سایز نمونه" onClick={event => { if (event.target === guide.current) guide.current?.close(); }}>
      <div className="size-guide-dialog-inner">
        <div className="size-guide-top"><div><p className="eyebrow">FIND YOUR FIT</p><h2>راهنمای انتخاب سایز</h2></div>
          <button type="button" className="icon-button" aria-label="بستن راهنمای سایز" onClick={() => guide.current?.close()}><X size={21}/></button></div>
        <p>این اندازه‌ها صرفاً مثال عمومی‌اند؛ اندازه‌گیری اختصاصی محصول هنوز ثبت نشده است.</p>
        <div className="size-table-scroll"><table className="size-table">
          <thead><tr><th>سایز</th><th>دور سینه</th><th>دور کمر</th><th>دور باسن</th></tr></thead>
          <tbody><tr><td>S</td><td>۸۴–۸۸</td><td>۶۶–۷۰</td><td>۹۰–۹۴</td></tr>
            <tr><td>M</td><td>۸۸–۹۴</td><td>۷۰–۷۶</td><td>۹۴–۱۰۰</td></tr>
            <tr><td>L</td><td>۹۴–۱۰۰</td><td>۷۶–۸۲</td><td>۱۰۰–۱۰۶</td></tr>
            <tr><td>XL</td><td>۱۰۰–۱۰۸</td><td>۸۲–۹۰</td><td>۱۰۶–۱۱۴</td></tr></tbody>
        </table></div><p className="muted small">همه اندازه‌ها به سانتی‌متر هستند. برای انتخاب واقعی باید جدول هر مدل جداگانه تأیید شود.</p>
        <Link href="/size-guide" className="text-link" onClick={() => guide.current?.close()}>توضیحات کامل راهنمای سایز ←</Link>
      </div>
    </dialog>
  </div>;
}
