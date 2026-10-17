export const toLatinDigits = (value: string): string =>
  value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

/** For digit strings that are not quantities (phone numbers, postal and tracking codes): no grouping. */
export const toPersianDigits = (value: string): string => value.replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);

export const normalizePersian = (value: string): string =>
  toLatinDigits(value.normalize('NFKC')).replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u200C\u200D]/g, ' ').replace(/[،,؛;:!؟?«»()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ').trim().toLocaleLowerCase('fa-IR');

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('fa-IR').format(value);

export const toman = (value: number): string => formatNumber(value) + ' تومان';

export const formatPercent = (value: number): string =>
  new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(value) + '٪';

export const discountPercent = (price: number, compareAt?: number): number =>
  compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;
