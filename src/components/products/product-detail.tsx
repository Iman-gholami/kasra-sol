'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, Heart, Ruler, ShoppingBag, X } from 'lucide-react';
import { getVariant } from '@/data/products';
import { useShop } from '@/components/shop-provider';
import { discountPercent, formatPercent, toman } from '@/lib/format';
import type { Product } from '@/types/store';

type Notice = { text: string; error: boolean };

export function ProductDetail({ product }: { product: Product }) {
  const { addToCart, openCart, isCartOpen, wishlist, toggleWishlist, hydrated } = useShop();
  const [imageIndex, setImageIndex] = useState(0);
  const [colorId, setColorId] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sizeNotice, setSizeNotice] = useState('');
  const [stickyVisible, setStickyVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const zoom = useRef<HTMLDialogElement>(null);
  const guide = useRef<HTMLDialogElement>(null);
  const zoomTrigger = useRef<HTMLButtonElement>(null);
  const guideTrigger = useRef<HTMLButtonElement>(null);
  const buyButton = useRef<HTMLButtonElement>(null);
  const colorOptions = useRef<HTMLDivElement>(null);
  const sizeOptions = useRef<HTMLDivElement>(null);
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null);
  const consumedSwipe = useRef(false);

  const color = product.colors.find(entry => entry.id === colorId);
  const variant = getVariant(product, colorId, size);
  const discount = discountPercent(product.price, product.compareAt);
  const isFavorite = hydrated && wishlist.includes(product.id);
  const ready = Boolean(colorId && size && variant?.stock && variant.stock >= quantity);

  useEffect(() => {
    const button = buyButton.current;
    if (!button || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0.45 }
    );
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Do not overlay a mobile keyboard; observer events avoid continuous scroll listeners.
    const viewport = window.visualViewport;
    const update = () => setKeyboardOpen(Boolean(viewport && window.innerHeight - viewport.height > 140));
    viewport?.addEventListener('resize', update);
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement &&
          event.target.matches('input, textarea, select, [contenteditable="true"]')) {
        setKeyboardOpen(true);
      }
    };
    const onBlur = () => window.setTimeout(update, 100);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onBlur);
    };
  }, []);

  function showImage(index: number) {
    setImageIndex((index + product.images.length) % product.images.length);
  }

  function onTouchStart(event: TouchEvent<HTMLElement>) {
    const point = event.touches[0];
    if (point) swipeOrigin.current = { x: point.clientX, y: point.clientY };
    consumedSwipe.current = false;
  }

  function onTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = swipeOrigin.current;
    swipeOrigin.current = null;
    const point = event.changedTouches[0];
    if (!start || !point) return;
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      consumedSwipe.current = true;
      showImage(imageIndex + (dx < 0 ? 1 : -1));
    }
  }

  function openZoom() {
    if (consumedSwipe.current) {
      consumedSwipe.current = false;
      return;
    }
    setDialogOpen(true);
    zoom.current?.showModal();
  }

  function closeZoom() { zoom.current?.close(); }
  function openGuide() { setDialogOpen(true); guide.current?.showModal(); }
  function closeGuide() { guide.current?.close(); }

  function focusOption(which: 'color' | 'size') {
    const container = which === 'color' ? colorOptions.current : sizeOptions.current;
    const button = container?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    container?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
    button?.focus({ preventScroll: true });
  }

  function chooseColor(id: string) {
    setColorId(id);
    const invalidated = Boolean(size && !getVariant(product, id, size)?.stock);
    if (invalidated) setSize('');
    setSizeNotice(invalidated ? 'سایز قبلی برای این رنگ ناموجود است؛ دوباره سایز انتخاب کن.' : '');
    setQuantity(1);
    setNotice(null);
  }

  function add() {
    if (!colorId || !size) {
      const missing = !colorId ? 'color' : 'size';
      setNotice({ text: missing === 'color' ? 'اول رنگ موردنظرت رو انتخاب کن.' : 'برای ادامه یک سایز موجود انتخاب کن.', error: true });
      focusOption(missing);
      return;
    }
    if (!variant?.stock || quantity > variant.stock) {
      setNotice({ text: 'این ترکیب ناموجود است یا تعداد انتخاب‌شده بیشتر از موجودی نمونه است.', error: true });
      focusOption('size');
      return;
    }
    const success = addToCart({ productId: product.id, colorId, size, quantity });
    setNotice({
      text: success ? 'انتخابت به سبد نمایشی اضافه شد.' : 'افزودن به سبد خرید ممکن نیست.',
      error: !success
    });
    // Keep shopping uninterrupted. The existing mini-cart remains available on demand.
  }

  function onStickyClick() {
    if (!colorId || !size) {
      add();
      return;
    }
    add();
  }

  const showSticky = stickyVisible && !dialogOpen && !isCartOpen && !keyboardOpen;

  return <div className="detail-layout pdp">
    <div className="pdp-gallery-column">
      <div className="pdp-gallery" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { swipeOrigin.current = null; }}>
        <button ref={zoomTrigger} className="gallery-main" type="button" onClick={openZoom}
          aria-label={'بزرگ‌نمایی تصویر ' + (imageIndex + 1) + ' محصول'}>
          <Image src={product.images[imageIndex]}
            alt={'تصویر نمایشی ساخته‌شده با هوش مصنوعی برای ' + product.name + '، تصویر ' + (imageIndex + 1)}
            fill priority={imageIndex === 0} sizes="(max-width: 600px) 100vw, (max-width: 1024px) 52vw, 45vw" />
          <span className="gallery-demo-label">تصویر نمایشی</span>
        </button>
        {product.images.length > 1 && <>
          <button type="button" className="pdp-gallery-arrow pdp-gallery-prev"
            aria-label="تصویر قبلی" onClick={() => showImage(imageIndex - 1)}><ChevronRight size={22}/></button>
          <button type="button" className="pdp-gallery-arrow pdp-gallery-next"
            aria-label="تصویر بعدی" onClick={() => showImage(imageIndex + 1)}><ChevronLeft size={22}/></button>
          <div className="pdp-gallery-counter" aria-live="polite" aria-atomic="true">
            {(imageIndex + 1).toLocaleString('fa-IR')} / {product.images.length.toLocaleString('fa-IR')}
          </div>
        </>}
      </div>
      <div className="gallery-thumbs" aria-label="تصاویر محصول">{product.images.map((image, index) =>
        <button key={image + index} className={'gallery-thumb' + (index === imageIndex ? ' selected' : '')}
          onClick={() => showImage(index)} type="button"
          aria-label={'نمایش تصویر ' + (index + 1)} aria-pressed={index === imageIndex}>
          <Image src={image} alt="" fill sizes="80px" loading="lazy" />
        </button>)}</div>
      <dialog ref={zoom} className="zoom-dialog" aria-label="نمای بزرگ محصول"
        onClose={() => { setDialogOpen(false); zoomTrigger.current?.focus(); }}
        onClick={event => { if (event.target === zoom.current) closeZoom(); }}>
        <button type="button" className="close-zoom" onClick={closeZoom} aria-label="بستن بزرگ‌نمایی"><X size={23}/></button>
        <div className="zoom-image"><Image src={product.images[imageIndex]} alt={'نمای بزرگ ' + product.name}
          fill sizes="(max-width: 650px) 90vw, 600px" /></div>
        <div className="pdp-zoom-controls">
          <button type="button" onClick={() => showImage(imageIndex - 1)} aria-label="تصویر قبلی"><ChevronRight size={21}/></button>
          <span>{(imageIndex + 1).toLocaleString('fa-IR')} / {product.images.length.toLocaleString('fa-IR')}</span>
          <button type="button" onClick={() => showImage(imageIndex + 1)} aria-label="تصویر بعدی"><ChevronLeft size={21}/></button>
        </div>
      </dialog>
    </div>
    <div className="detail-copy">
      <Link className="detail-kicker" href={'/category/' + product.category}>
        {product.category === 'shomiz' ? 'شومیز' : product.category === 'manto' ? 'مانتو' : 'تیشرت'} / کالکشن کسری ←
      </Link>
      <h1>{product.name}</h1>
      <div className="detail-price">
        <div className="price-line"><strong>{toman(product.price)}</strong>
          {product.compareAt && <del>{toman(product.compareAt)}</del>}</div>
        {discount > 0 && <p className="sale">{formatPercent(discount)} تخفیف نمایشی</p>}
      </div>
      <p className="detail-desc">{product.description}</p>

      <section className="buy-panel" aria-label="انتخاب مشخصات و خرید">
        <div className="variant-group">
          <div className="variant-label">رنگ <span>{color ? '— ' + color.name : '— انتخاب کن'}</span></div>
          <div className="swatch-list" ref={colorOptions}>{product.colors.map(entry => {
            const available = product.variants.some(v => v.colorId === entry.id && v.stock > 0);
            return <button key={entry.id} type="button" disabled={!available}
              className={'swatch' + (colorId === entry.id ? ' selected' : '') + (!available ? ' unavailable' : '')}
              title={entry.name} aria-label={'رنگ ' + entry.name + (!available ? ' ناموجود' : '')}
              aria-pressed={colorId === entry.id} onClick={() => chooseColor(entry.id)}>
              <span style={{ backgroundColor: entry.hex }}/><small>{entry.name}</small>
            </button>;
          })}</div>
        </div>
        <div className="variant-group">
          <div className="variant-label">سایز <span>— {size || 'انتخاب کن'}</span>
            <button type="button" ref={guideTrigger} className="size-guide-trigger" onClick={openGuide}>
              <Ruler size={16}/> راهنمای سایز
            </button></div>
          <div className="size-list" dir="ltr" ref={sizeOptions}>{product.sizes.map(entry => {
            const available = colorId ? Boolean(getVariant(product, colorId, entry)?.stock) :
              product.variants.some(v => v.size === entry && v.stock > 0);
            return <button key={entry} type="button" disabled={!available}
              className={'size-option' + (size === entry ? ' selected' : '')} aria-pressed={size === entry}
              aria-label={'سایز ' + entry + (available ? '' : ' ناموجود')}
              onClick={() => { setSize(entry); setSizeNotice(''); setQuantity(1); setNotice(null); }}>
              {entry}
            </button>;
          })}</div>
          {sizeNotice && <p className="pdp-size-notice" role="status">{sizeNotice}</p>}
        </div>
        <div className="quantity-row"><span>تعداد {variant?.stock ? '· موجودی نمونه: ' + variant.stock.toLocaleString('fa-IR') : ''}</span>
          <div className="qty-stepper">
            <button type="button" aria-label="افزایش تعداد" disabled={!variant?.stock || quantity >= variant.stock}
              onClick={() => setQuantity(q => q + 1)}>+</button>
            <span>{quantity.toLocaleString('fa-IR')}</span>
            <button type="button" aria-label="کاهش تعداد" disabled={quantity < 2}
              onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          </div>
        </div>
        {notice && <p role={notice.error ? 'alert' : 'status'}
          className={'status-message purchase-feedback' + (notice.error ? ' error' : '')}>
          {!notice.error && <Check size={18} aria-hidden="true"/>}{notice.text}
          {!notice.error && <>
            <Link className="subtle-link" href="/cart">مشاهده سبد</Link>
            <button type="button" className="pdp-quick-cart-link" onClick={openCart}>سبد سریع</button>
          </>}
        </p>}
        <div className="purchase-row">
          <button ref={buyButton} type="button" className="btn btn-dark" onClick={add}>
            <ShoppingBag size={18}/> {ready ? 'افزودن به سبد خرید' : 'رنگ و سایز رو انتخاب کن'}
          </button>
          <button type="button" className="btn btn-outline pdp-wishlist"
            aria-label={isFavorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
            aria-pressed={isFavorite} onClick={() => toggleWishlist(product.id)}>
            <Heart size={19} fill={isFavorite ? 'currentColor' : 'none'}/>
          </button>
        </div>
        <p className="buy-panel-note">رنگ، سایز و موجودی در این نسخه آزمایشی‌اند.</p>
      </section>
      <p className="pdp-shipping-note">اطلاعات ارسال و بازگشت هنوز نهایی نشده است. <Link href="/shipping-and-returns">توضیحات نمونه ←</Link></p>
      <p className="demo-inline-note">عکس‌های مدل با هوش مصنوعی ساخته شده‌اند و ممکن است با رنگ و جزئیات این کالا یکسان نباشند؛ قیمت‌ها هم نمایشی‌اند.</p>
      <div className="detail-extras">
        <details><summary>جنس، فرم و نگهداری</summary><p>جنس نمونه: {product.material} · فرم نمونه: {product.fit}</p><p>{product.care}</p></details>
        <details><summary>ارسال و بازگشت</summary><p>شرایط قطعی ارسال و بازگشت هنوز تعیین نشده‌اند. <Link className="subtle-link" href="/shipping-and-returns">مشاهده صفحه راهنما</Link></p></details>
      </div>
    </div>

    <dialog ref={guide} className="size-guide-dialog" aria-label="راهنمای سایز نمونه"
      onClose={() => { setDialogOpen(false); guideTrigger.current?.focus(); }}
      onClick={event => { if (event.target === guide.current) closeGuide(); }}>
      <div className="size-guide-dialog-inner">
        <div className="size-guide-top"><div><p className="eyebrow">FIND YOUR FIT</p><h2>راهنمای انتخاب سایز</h2></div>
          <button type="button" className="icon-button" aria-label="بستن راهنمای سایز" onClick={closeGuide}><X size={21}/></button>
        </div>
        <p>اندازه‌گیری اختصاصی این کالا هنوز ثبت نشده است؛ بدون جدول واقعی، پیشنهاد سایز قطعی نمی‌دهیم.</p>
        <p>برای انتخاب بهتر، دور سینه، کمر و باسن را با متر نرم اندازه بگیر. پیش از خرید واقعی باید اندازه‌های همین مدل با این مقادیر مقایسه شوند.</p>
        <Link href="/size-guide" className="text-link" onClick={closeGuide}>مطالعه راهنمای عمومی سایز ←</Link>
      </div>
    </dialog>

    <div className="pdp-sticky-reserve" aria-hidden="true"/>
    <div className={'pdp-sticky-bar' + (showSticky ? ' is-visible' : '')}
      aria-hidden={!showSticky} inert={!showSticky}>
      {notice && !notice.error &&
        <div className="pdp-sticky-confirm" role="status"><Check size={16}/>
          <span>به سبد اضافه شد</span><Link href="/cart">مشاهده سبد ←</Link>
        </div>}
      <div className="pdp-sticky-inner">
        <div className="pdp-sticky-price"><span>قیمت نمایشی</span><strong>{toman(product.price)}</strong></div>
        <button type="button" className="btn btn-dark" onClick={onStickyClick}
          aria-label={ready ? 'افزودن به سبد خرید از نوار پایین' : 'انتخاب رنگ و سایز از نوار پایین'}>
          <ShoppingBag size={18}/>{ready ? 'افزودن به سبد' : (!colorId ? 'انتخاب رنگ و سایز' : 'انتخاب سایز')}
        </button>
      </div>
    </div>
  </div>;
}
