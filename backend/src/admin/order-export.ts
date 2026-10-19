// CSV export of orders for the shop's own spreadsheets (shipping lists, bookkeeping). The file holds customer
// names, phones and addresses, so the route needs `orders:export` and every download is audited.

export type ExportRow = {
  id: string; status: string; payment: string; shipping: string; code: string | null;
  subtotal: number; discount: number; shippingCost: number; total: number; createdAt: Date;
  address: { name?: string; mobile?: string; province?: string; city?: string; address?: string; postal?: string; notes?: string };
  items: string; units: number;
};
/** More rows than this are refused (narrow the period or status) rather than silently cut off. */
export const EXPORT_LIMIT = 5000;

const STATUS: Record<string, string> = {
  pending_payment: 'در انتظار پرداخت', confirmed_cod: 'ثبت‌شده، آماده پردازش', preparing: 'در حال آماده‌سازی',
  shipped: 'ارسال‌شده', delivered: 'تحویل‌شده', cancelled: 'لغوشده'
};
const PAYMENT: Record<string, string> = { cod: 'پرداخت در محل', online: 'پرداخت اینترنتی (پرداخت‌نشده)' };
const SHIPPING: Record<string, string> = { post: 'پست پیشتاز', express: 'ارسال سریع', courier: 'پیک تهران' };
const HEADER = ['شماره سفارش', 'شناسه کامل', 'تاریخ ثبت (تهران)', 'وضعیت', 'روش پرداخت', 'روش ارسال', 'نام گیرنده',
  'موبایل', 'استان', 'شهر', 'نشانی', 'کد پستی', 'توضیحات مشتری', 'اقلام', 'تعداد', 'جمع کالاها (تومان)', 'تخفیف (تومان)',
  'کد تخفیف', 'هزینه ارسال (تومان)', 'مبلغ نهایی (تومان)'];
const persian = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

/** Solar Hijri date and Tehran time with Latin digits, e.g. `1405/07/27 16:34`, so spreadsheets sort it as text. */
export function persianDateTime(at: Date) {
  const part = Object.fromEntries(persian.formatToParts(at).map(p => [p.type, p.value]));
  return part.year + '/' + part.month + '/' + part.day + ' ' + part.hour + ':' + part.minute;
}

/** One CSV field. Text starting with = + - @ (or a tab/CR) is a formula to Excel and Sheets; customer-typed text
 * (names, addresses, notes) must never run as one, so such text is prefixed with an apostrophe. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
/** A digits-only value (mobile, postal code) that spreadsheets would otherwise read as a number and strip of its
 * leading zero. Only validated digit strings take this form, so it cannot carry a formula. */
export function csvDigits(value: string | undefined): string {
  return value && /^\d{1,20}$/.test(value) ? '="' + value + '"' : csvCell(value);
}

/** UTF-8 with a byte-order mark, so Excel shows Persian text correctly when the file is opened directly. */
export function ordersCsv(rows: ExportRow[]): string {
  const lines = [HEADER.map(csvCell).join(',')];
  for (const row of rows) {
    const a = row.address ?? {};
    lines.push([
      csvCell(row.id.slice(0, 8).toUpperCase()), csvCell(row.id), csvCell(persianDateTime(new Date(row.createdAt))),
      csvCell(STATUS[row.status] ?? row.status), csvCell(PAYMENT[row.payment] ?? row.payment),
      csvCell(SHIPPING[row.shipping] ?? row.shipping), csvCell(a.name), csvDigits(a.mobile), csvCell(a.province), csvCell(a.city),
      csvCell(a.address), csvDigits(a.postal), csvCell(a.notes), csvCell(row.items), csvCell(row.units),
      csvCell(row.subtotal), csvCell(row.discount), csvCell(row.code), csvCell(row.shippingCost), csvCell(row.total)
    ].join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
