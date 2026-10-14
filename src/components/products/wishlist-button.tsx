'use client';

import { Heart } from 'lucide-react';
import { useShop } from '@/components/shop-provider';
import { useToast } from '@/components/ui/toast';

/** Card-level wishlist toggle: the only part of a product card that hydrates. */
export function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
  const { wishlist, toggleWishlist, hydrated } = useShop();
  const notify = useToast();
  const liked = hydrated && wishlist.includes(productId);
  return <button type="button" className={'wishlist-button' + (liked ? ' is-liked' : '')}
    aria-label={(liked ? 'حذف از علاقه‌مندی‌ها: ' : 'افزودن به علاقه‌مندی‌ها: ') + productName} aria-pressed={liked}
    onClick={() => {
      toggleWishlist(productId);
      notify(liked
        ? { message: '«' + productName + '» از علاقه‌مندی‌ها برداشته شد.' }
        : { message: '«' + productName + '» در علاقه‌مندی‌ها ذخیره شد.', action: { label: 'مشاهده', href: '/wishlist' } });
    }}>
    <Heart size={19} strokeWidth={1.7} fill={liked ? 'currentColor' : 'none'} aria-hidden="true"/>
  </button>;
}
