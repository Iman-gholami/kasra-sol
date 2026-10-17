'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_PAYMENT, DEFAULT_SHIPPING, paymentMethods, shippingMethods,
  type OrderTotals, type PaymentMethodId, type ShippingMethodId } from '@/lib/checkout';
import type { CartItem } from '@/types/store';

/** Checkout state that must survive a refresh or a step change, kept in sessionStorage: it never leaves
 * this browser tab, is never sent anywhere and disappears when the tab closes. */

export type Field = 'name' | 'mobile' | 'province' | 'city' | 'address' | 'postal' | 'notes';
export type Fields = Record<Field, string>;
export type CheckoutDraft = { fields: Fields; shipping: ShippingMethodId; payment: PaymentMethodId; code: string };
export type DemoOrder = {
  id: string; items: CartItem[]; fields: Fields; shipping: ShippingMethodId; payment: PaymentMethodId;
  code: string; totals: OrderTotals;
};

export const emptyFields: Fields = { name: '', mobile: '', province: '', city: '', address: '', postal: '', notes: '' };
const DRAFT_KEY = 'kasra-checkout-draft-v1';
const ORDER_KEY = 'kasra-demo-order-v1';

function read(key: string): unknown {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch { /* private mode or quota: the flow still works, it just won't survive a refresh */ }
}

/** Call only in the browser (the checkout renders after the cart store hydrates). */
export function loadDraft(): CheckoutDraft {
  const value = read(DRAFT_KEY) as Partial<CheckoutDraft> | null;
  const fields = { ...emptyFields };
  if (value?.fields && typeof value.fields === 'object') {
    for (const key of Object.keys(emptyFields) as Field[]) {
      const entry = (value.fields as Partial<Fields>)[key];
      if (typeof entry === 'string') fields[key] = entry;
    }
  }
  return {
    fields,
    shipping: shippingMethods.some(m => m.id === value?.shipping) ? value!.shipping! : DEFAULT_SHIPPING,
    payment: paymentMethods.some(m => m.id === value?.payment) ? value!.payment! : DEFAULT_PAYMENT,
    code: typeof value?.code === 'string' ? value.code : ''
  };
}
export const saveDraft = (draft: CheckoutDraft) => write(DRAFT_KEY, draft);
/** The cart applies the discount code; checkout reads it from the same draft. */
export const saveCode = (code: string) => saveDraft({ ...loadDraft(), code });

export function completeOrder(order: DemoOrder) {
  write(ORDER_KEY, order);
  write(DRAFT_KEY, null);
  cachedRaw = undefined;
}

// The confirmation page reads the order through an external store so the server render (no order known
// yet) and the first client render agree; the snapshot is cached by its raw string to stay stable.
let cachedRaw: string | null | undefined;
let cachedOrder: DemoOrder | null = null;
function orderSnapshot(): DemoOrder | null {
  let raw: string | null = null;
  try { raw = sessionStorage.getItem(ORDER_KEY); } catch { /* unavailable */ }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed = raw ? JSON.parse(raw) as DemoOrder : null;
      cachedOrder = parsed && typeof parsed.id === 'string' && Array.isArray(parsed.items) && parsed.totals ? parsed : null;
    } catch { cachedOrder = null; }
  }
  return cachedOrder;
}
const noop = () => () => {};

/** `undefined` while unknown (server render and hydration), `null` when this tab has no finished order. */
export const useLastOrder = () => useSyncExternalStore(noop, orderSnapshot, () => undefined);
