import type { CategorySlug, ProductColor } from '@/types/store';

/** Lightweight, client-safe facet configuration — no product catalog bundled. */
export const categories: { slug: CategorySlug; title: string; description: string }[] = [
  { slug: 'shomiz', title: 'شومیز', description: 'جزئیات ظریف برای استایل روزمره و مهمانی' },
  { slug: 'manto', title: 'مانتو', description: 'لایه‌های راحت، خوش‌فرم و امروزی' },
  { slug: 'tshirt', title: 'تیشرت', description: 'انتخاب‌های ساده برای هر روز' }
];
export const palette: ProductColor[] = [
  { id: 'cream', name: 'کرم', hex: '#e7d8c2' },
  { id: 'black', name: 'مشکی', hex: '#34312f' },
  { id: 'rose', name: 'رز خاکی', hex: '#b98a83' },
  { id: 'sage', name: 'سبز سدری', hex: '#84958a' },
  { id: 'blue', name: 'آبی دودی', hex: '#7c929d' },
  { id: 'white', name: 'سفید', hex: '#f6f3ed' }
];
export const standardSizes = ['S', 'M', 'L', 'XL'] as const;
