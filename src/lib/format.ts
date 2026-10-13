export const toLatinDigits = (value: string): string =>
  value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

export const normalizePersian = (value: string): string =>
  toLatinDigits(value).replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ')
    .trim().toLocaleLowerCase('fa-IR');

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('fa-IR').format(value);

export const toman = (value: number): string => formatNumber(value) + ' تومان';

export const formatPercent = (value: number): string =>
  new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(value) + '٪';

export const discountPercent = (price: number, compareAt?: number): number =>
  compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;
