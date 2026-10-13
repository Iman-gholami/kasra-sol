'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { byId } from '@/data/products';
import { useShop } from '@/components/shop-provider';
import { toman, formatNumber } from '@/lib/format';

export function CartPage() {
  const { cart, hydrated, updateQuantity, removeFromCart } = useShop();
  if (!hydrated) return <div className="container loading-skeleton" role="status" aria-label="بارگذاری سبد" />;
  const lines = cart.flatMap((item) => { const product = byId(item.productId); return product ? [{ item, product }] : []; });
  if (!lines.length) return <div className="container"><h1 className="page-heading">سبد خرید</h1><div className="empty-state"><h2>سبدت هنوز خالیه</h2><p>اول یک لباس که دوستش داری انتخاب کن.</p><Link className="btn btn-dark" href="/shop">مشاهده محصولات <ArrowLeft size={17} /></Link></div></div>;
  const subtotal = lines.reduce((sum, {item, product}) => sum + product.price * item.quantity, 0);
  const savings = lines.reduce((sum, {item, product}) => sum + Math.max(0, (product.compareAt ?? product.price) - product.price) * item.quantity, 0);
  return <div className="container"><h1 className="page-heading">سبد خرید <span className="muted small">({formatNumber(lines.length)} مدل)</span></h1>
    <div className="cart-layout">
      <div>{lines.map(({item, product}) => { const key = item.productId + item.colorId + item.size;
        const color = product.colors.find((c) => c.id === item.colorId);
        const stock = product.variants.find((v) => v.colorId === item.colorId && v.size === item.size)?.stock ?? 0;
        return <article className="cart-item" key={key}>
          <Link className="cart-img" href={'/product/' + product.slug}><Image src={product.images[0]} alt={'تصویر ' + product.name} fill sizes="115px" /></Link>
          <div><h3><Link href={'/product/' + product.slug}>{product.name}</Link></h3><p>رنگ: {color?.name ?? '—'} / سایز: <span dir="ltr">{item.size}</span></p><p>هر عدد: {toman(product.price)}</p>
            <div className="qty-stepper"><button type="button" onClick={() => updateQuantity(item, item.quantity + 1)} disabled={item.quantity >= stock} aria-label={'افزایش تعداد ' + product.name}>+</button><span>{formatNumber(item.quantity)}</span><button type="button" onClick={() => updateQuantity(item, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={'کاهش تعداد ' + product.name}>−</button></div>
          </div>
          <div className="cart-price"><strong>{toman(product.price * item.quantity)}</strong><button type="button" onClick={() => removeFromCart(item)} className="link-button">حذف</button></div>
        </article>;
      })}<p className="muted small" style={{marginTop:24}}>قیمت‌ها و موجودی‌ها نمونه هستند و به سرور فروشگاه متصل نیستند.</p><Link className="text-link" href="/shop">ادامه خرید <ArrowLeft size={18} /></Link></div>
      <aside className="summary-card"><h2>خلاصه سفارش نمایشی</h2><div className="summary-row"><span>جمع اقلام</span><strong>{toman(subtotal)}</strong></div>{savings > 0 && <div className="summary-row"><span>صرفه‌جویی نمونه</span><span>{toman(savings)}</span></div>}
        <div className="summary-row"><span>هزینه ارسال</span><span>هنوز محاسبه نشده</span></div>
        <div className="summary-row total"><span>مبلغ اقلام (بدون ارسال)</span><strong>{toman(subtotal)}</strong></div>
        <Link href="/checkout" className="btn btn-dark">ادامه تا تسویه‌حساب نمایشی <ArrowLeft size={18} /></Link><p>پرداخت واقعی و ثبت سفارش انجام نمی‌شود.</p>
      </aside>
    </div>
  </div>;
}
