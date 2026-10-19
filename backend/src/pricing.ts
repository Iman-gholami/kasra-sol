export type Shipping = 'post' | 'express' | 'courier';
export type Payment = 'online' | 'cod';
export type PriceLine = { price: number; quantity: number };
// Monetary columns currently use PostgreSQL integer, not bigint.
const MAX_AMOUNT = 2_147_483_647;
export class DomainError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export function calculate(lines: PriceLine[], shipping: Shipping, payment: Payment, code: string, province: string, city: string) {
  if (shipping === 'courier' && !(province === 'تهران' && city.trim() === 'تهران'))
    throw new DomainError(422, 'پیک فقط برای شهر تهران مجاز است.');
  if (payment === 'cod' && shipping !== 'courier')
    throw new DomainError(422, 'پرداخت در محل فقط برای پیک تهران مجاز است.');
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || subtotal > MAX_AMOUNT)
    throw new DomainError(422, 'مبلغ سفارش از محدوده مجاز خارج است.');
  const normalized = code.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g, '').toUpperCase();
  let discount = 0;
  if (normalized === 'KASRA10') discount = Math.min(Math.round(subtotal * .1), 300_000);
  else if (normalized === 'WELCOME') {
    if (subtotal < 1_500_000) throw new DomainError(422, 'حداقل مبلغ کد WELCOME برابر ۱۵۰۰۰۰۰ تومان است.');
    discount = 150_000;
  } else if (normalized) throw new DomainError(422, 'کد تخفیف نامعتبر است.');
  const shippingCost = shipping === 'post' ? (subtotal >= 2_500_000 ? 0 : 85_000) :
    shipping === 'express' ? 145_000 : 120_000;
  const total = subtotal - discount + shippingCost;
  if (total > MAX_AMOUNT) throw new DomainError(422, 'مبلغ سفارش از محدوده مجاز خارج است.');
  return { subtotal, discount, shipping: shippingCost, total };
}
