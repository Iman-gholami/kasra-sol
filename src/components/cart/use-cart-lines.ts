'use client';

import { useState } from 'react';
import { getShopProduct } from '@/components/shop-provider';
import { useShop } from '@/components/shop-provider';
import { cartTotals } from '@/lib/checkout';
import type { CartItem, Product } from '@/types/store';

export const lineKey = (item: CartItem) => item.productId + ':' + item.colorId + ':' + item.size;

export type CartRow =
  | { kind: 'line'; key: string; item: CartItem; product: Product; stock: number }
  | { kind: 'removed'; key: string; item: CartItem; product: Product; moved: boolean };

type Removed = { item: CartItem; moved: boolean };

/** Cart lines in a stable on-screen order, with in-place "removed — undo" rows.
 * Uses only the existing store API: removal is immediate (totals and badges stay honest) and
 * undo re-adds the same variant and quantity, which keeps its original position on screen.
 * "Save for later" is a removal that also puts the product in the wishlist. */
export function useCartLines() {
  const { cart, hydrated, catalogError, wishlist, addToCart, removeFromCart, updateQuantity, toggleWishlist } = useShop();
  const [order, setOrder] = useState<string[]>([]);
  const [removed, setRemoved] = useState<Record<string, Removed>>({});

  const keys = cart.map(lineKey);
  const merged = [...order.filter(key => keys.includes(key) || removed[key]), ...keys.filter(key => !order.includes(key))];
  if (merged.length !== order.length || merged.some((key, index) => key !== order[index])) setOrder(merged);

  const rows: CartRow[] = merged.flatMap((key): CartRow[] => {
    const item = cart.find(entry => lineKey(entry) === key);
    if (item) {
      const product = getShopProduct(item.productId);
      if (!product) return [];
      const stock = product.variants.find(v => v.colorId === item.colorId && v.size === item.size)?.stock ?? 0;
      return [{ kind: 'line', key, item, product, stock }];
    }
    const gone = removed[key];
    const product = gone && getShopProduct(gone.item.productId);
    return gone && product ? [{ kind: 'removed', key, item: gone.item, product, moved: gone.moved }] : [];
  });
  const lines = rows.filter((row): row is Extract<CartRow, { kind: 'line' }> => row.kind === 'line');
  const totals = cartTotals(lines);

  function remove(item: CartItem, moved = false) {
    if (moved && !wishlist.includes(item.productId)) toggleWishlist(item.productId);
    setRemoved(current => ({ ...current, [lineKey(item)]: { item, moved } }));
    removeFromCart(item);
  }
  function undo(item: CartItem) {
    addToCart({ ...item });
    setRemoved(current => {
      const next = { ...current };
      delete next[lineKey(item)];
      return next;
    });
  }

  return { hydrated, catalogError, rows, lines, ...totals, remove, undo, updateQuantity };
}
