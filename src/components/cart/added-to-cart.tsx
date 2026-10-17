'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, CheckCircle2, X } from 'lucide-react';
import { byId } from '@/data/products';
import { useShop, type AddedItem } from '@/components/shop-provider';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { LineDetails } from '@/components/cart/line-details';
import { FreeShippingMeter } from '@/components/cart/free-shipping-meter';
import { cartTotals, resolveLines } from '@/lib/checkout';
import { formatNumber, toman } from '@/lib/format';

/** Confirmation after adding to the cart: what was added, what the cart now holds, and the two next steps.
 * A bottom sheet on phones, a panel under the header cart icon on larger screens. "ادامه خرید" takes focus
 * (the non-committal choice) and closing returns focus to the add button. */
export function AddedToCart() {
  const { added, dismissAdded } = useShop();
  const pathname = usePathname();
  const open = Boolean(added && added.path === pathname);
  const mounted = useMountedOnce(open);
  // Keep the last item on screen while the sheet animates closed.
  const [shown, setShown] = useState<AddedItem | null>(added);
  if (added && added !== shown) setShown(added);
  // Navigating away (a link, Back) closes it for good, so returning to the page does not reopen it.
  useEffect(() => { if (added && added.path !== pathname) dismissAdded(); }, [added, pathname, dismissAdded]);
  if (!mounted || !shown) return null;
  return <Sheet open={open} onClose={dismissAdded} labelledBy="added-to-cart-title" className="sheet-center added-dialog" swipe="down">
    <AddedContent item={shown} onClose={dismissAdded}/>
  </Sheet>;
}

function AddedContent({ item, onClose }: { item: AddedItem; onClose: () => void }) {
  const { cart } = useShop();
  const product = byId(item.productId);
  const { units, subtotal } = cartTotals(resolveLines(cart));
  if (!product) return null;
  return <div className="sheet-inner">
    <div className="sheet-header" data-sheet-drag>
      <span className="sheet-handle" aria-hidden="true"/>
      <h2 className="sheet-title added-title" id="added-to-cart-title"><CheckCircle2 size={22} aria-hidden="true"/> به سبد خرید اضافه شد</h2>
      <button type="button" className="icon-button" aria-label="بستن پیام افزودن به سبد" onClick={onClose}><X size={22} aria-hidden="true"/></button>
    </div>
    <div className="sheet-body added-body">
      <div className="added-item">
        <span className="added-thumb"><Image src={product.images[0]} alt="" fill sizes="72px"/></span>
        <div className="added-item-info">
          <p className="added-item-name">{product.name}</p>
          <LineDetails item={item} product={product} showQuantity/>
          <strong className="price">{toman(product.price * item.quantity)}</strong>
        </div>
      </div>
      <p className="added-cart-line">
        <span>سبد خرید تو: {formatNumber(units)} کالا</span>
        <strong className="price">{toman(subtotal)}</strong>
      </p>
      <FreeShippingMeter subtotal={subtotal}/>
    </div>
    <div className="sheet-footer added-actions">
      <div className="added-buttons">
        <Link href="/checkout" className="btn btn-primary" onClick={onClose}>ثبت سفارش <ArrowLeft size={18} aria-hidden="true"/></Link>
        <button type="button" className="btn btn-secondary" data-autofocus onClick={onClose}>ادامه خرید</button>
      </div>
      <Link href="/cart" className="text-link added-cart-link" onClick={onClose}>مشاهده و ویرایش سبد خرید</Link>
    </div>
  </div>;
}
