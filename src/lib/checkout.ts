import { byId } from '@/data/products';
import { formatNumber, normalizePersian, toLatinDigits } from '@/lib/format';
import type { CartItem, Product } from '@/types/store';

/** Demo commerce rules for the cart and checkout. Every amount and rule here is sample data chosen to
 * exercise the interface (free-shipping progress, method restrictions, code errors). A real store must
 * compute shipping, discounts and totals on the server and treat these values as display only. */

export const FREE_SHIPPING_THRESHOLD = 2_500_000;

export type ShippingMethodId = 'post' | 'express' | 'courier';
export type ShippingMethod = {
  id: ShippingMethodId; title: string; eta: string; price: number;
  /** Becomes free once the item total reaches FREE_SHIPPING_THRESHOLD. */
  freeEligible: boolean;
  /** Same-day courier: only inside the city of Tehran. */
  tehranOnly: boolean;
};

export const shippingMethods: ShippingMethod[] = [
  { id: 'post', title: 'پست پیشتاز', eta: '۳ تا ۵ روز کاری', price: 85_000, freeEligible: true, tehranOnly: false },
  { id: 'express', title: 'ارسال سریع', eta: '۱ تا ۲ روز کاری', price: 145_000, freeEligible: false, tehranOnly: false },
  { id: 'courier', title: 'پیک همان‌روز', eta: 'امروز، برای سفارش تا ساعت ۱۶', price: 120_000, freeEligible: false, tehranOnly: true }
];
export const DEFAULT_SHIPPING: ShippingMethodId = 'post';

export type PaymentMethodId = 'online' | 'cod';
export type PaymentMethod = { id: PaymentMethodId; title: string; description: string; courierOnly: boolean };

export const paymentMethods: PaymentMethod[] = [
  { id: 'online', title: 'پرداخت اینترنتی', description: 'با کارت‌های بانکی عضو شتاب، در درگاه پرداخت', courierOnly: false },
  { id: 'cod', title: 'پرداخت در محل', description: 'با کارت‌خوان، هنگام تحویل سفارش', courierOnly: true }
];
export const DEFAULT_PAYMENT: PaymentMethodId = 'online';

export const shippingById = (id: ShippingMethodId) => shippingMethods.find(method => method.id === id) ?? shippingMethods[0];
export const paymentById = (id: PaymentMethodId) => paymentMethods.find(method => method.id === id) ?? paymentMethods[0];

const isTehranCity = (province: string, city: string) => province === 'تهران' && normalizePersian(city) === 'تهران';

/** Why a shipping method cannot be used for this address, or undefined when it can. */
export function shippingRestriction(method: ShippingMethod, province: string, city: string): string | undefined {
  return method.tehranOnly && !isTehranCity(province, city) ? 'فقط برای نشانی‌های داخل شهر تهران' : undefined;
}
export function paymentRestriction(method: PaymentMethod, shipping: ShippingMethodId): string | undefined {
  return method.courierOnly && shipping !== 'courier' ? 'فقط همراه با پیک همان‌روز' : undefined;
}

export const shippingCost = (method: ShippingMethod, subtotal: number) =>
  method.freeEligible && subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : method.price;

export function freeShippingProgress(subtotal: number) {
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  return { remaining, reached: remaining === 0, ratio: Math.min(1, subtotal / FREE_SHIPPING_THRESHOLD) };
}

export type Line = { item: CartItem; product: Product };

export const resolveLines = (cart: CartItem[], lookup: (id: string) => Product | undefined = byId): Line[] =>
  cart.flatMap(item => { const product = lookup(item.productId); return product ? [{ item, product }] : []; });

/** `original` is the price before product markdowns; `savings` is what those markdowns take off. */
export function cartTotals(lines: Line[]) {
  let units = 0, subtotal = 0, original = 0;
  for (const { item, product } of lines) {
    units += item.quantity;
    subtotal += product.price * item.quantity;
    original += Math.max(product.price, product.compareAt ?? product.price) * item.quantity;
  }
  return { units, subtotal, original, savings: original - subtotal };
}

type Discount = { code: string; label: string; percent?: number; amount?: number; cap?: number; minSubtotal?: number };

/** Sample codes, shown to testers on the payment step. */
export const discountCodes: Discount[] = [
  { code: 'KASRA10', label: '۱۰٪ تخفیف، تا سقف ۳۰۰٬۰۰۰ تومان', percent: 10, cap: 300_000 },
  { code: 'WELCOME', label: '۱۵۰٬۰۰۰ تومان تخفیف برای خرید از ۱٬۵۰۰٬۰۰۰ تومان', amount: 150_000, minSubtotal: 1_500_000 }
];

/** Tolerates spaces, lower case and Persian or Arabic digits ("kasra ۱۰"). */
export const normalizeCode = (value: string) => toLatinDigits(value).replace(/\s+/g, '').toUpperCase();

export type DiscountResult =
  | { ok: true; code: string; label: string; amount: number }
  | { ok: false; message: string };

export function applyDiscount(input: string, subtotal: number): DiscountResult {
  const code = normalizeCode(input);
  if (!code) return { ok: false, message: 'کد تخفیف را وارد کن.' };
  const discount = discountCodes.find(entry => entry.code === code);
  if (!discount) return { ok: false, message: 'این کد معتبر نیست. حروف و اعداد کد را دوباره بررسی کن.' };
  if (discount.minSubtotal && subtotal < discount.minSubtotal) {
    return { ok: false, message: 'این کد برای خرید از ' + formatNumber(discount.minSubtotal) + ' تومان است؛ '
      + formatNumber(discount.minSubtotal - subtotal) + ' تومان دیگر به سبدت اضافه کن.' };
  }
  const raw = discount.percent ? Math.round(subtotal * discount.percent / 100) : discount.amount ?? 0;
  return { ok: true, code, label: discount.label, amount: Math.min(raw, discount.cap ?? raw, subtotal) };
}

export function orderTotals(lines: Line[], shippingId: ShippingMethodId, code: string) {
  const totals = cartTotals(lines);
  const discount = code ? applyDiscount(code, totals.subtotal) : null;
  const discountAmount = discount?.ok ? discount.amount : 0;
  const shipping = shippingCost(shippingById(shippingId), totals.subtotal);
  return { ...totals, discount: discountAmount, shipping, total: totals.subtotal - discountAmount + shipping };
}
export type OrderTotals = ReturnType<typeof orderTotals>;
