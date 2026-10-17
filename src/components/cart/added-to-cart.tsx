'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, ShoppingBag, X } from 'lucide-react';
import { byId } from '@/data/products';
import { useShop, type AddedItem } from '@/components/shop-provider';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { LineDetails } from '@/components/cart/line-details';

/** Confirmation after adding to the cart, kept deliberately short: a success badge, a friendly line, what
 * was added and the two next steps, stacked with the primary one at the bottom (the thumb zone).
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
  const product = byId(item.productId);
  if (!product) return null;
  return <div className="sheet-inner added-sheet">
    <div className="sheet-header" data-sheet-drag>
      <span className="sheet-handle" aria-hidden="true"/>
      <button type="button" className="icon-button added-close" aria-label="بستن پیام افزودن به سبد" onClick={onClose}><X size={22} aria-hidden="true"/></button>
    </div>
    <div className="sheet-body added-body">
      <span className="added-badge" aria-hidden="true"><ShoppingBag size={34} strokeWidth={1.6}/><Check size={16} strokeWidth={3}/></span>
      <p className="added-kicker">انتخاب قشنگیه!</p>
      <h2 className="sheet-title added-title" id="added-to-cart-title">به سبد خرید اضافه شد</h2>
      <div className="added-item">
        <span className="added-thumb"><Image src={product.images[0]} alt="" fill sizes="48px"/></span>
        <div className="added-item-info">
          <p className="added-item-name">{product.name}</p>
          <LineDetails item={item} product={product} showQuantity/>
        </div>
      </div>
    </div>
    <div className="sheet-footer added-actions">
      <button type="button" className="btn btn-secondary btn-lg btn-block" data-autofocus onClick={onClose}>ادامه خرید</button>
      <Link href="/cart" className="btn btn-primary btn-lg btn-block" onClick={onClose}>مشاهده سبد خرید</Link>
    </div>
  </div>;
}
