import type { CategorySlug } from '@/types/store';

export type WeekLook = { day: string; title: string; category: CategorySlug; color: string; image: string };

/** The home page's week of looks: one model, one outfit for each working day of the Iranian week. The photos are the
 * lookbook set re-set on the studio gray (scripts/studio-photos.py), so the six stand side by side as one shoot.
 * Each look opens the catalog on its category and color. Light and dark outfits alternate along the row. */
export const weekLooks: WeekLook[] = [
  { day: 'شنبه', title: 'شومیز کرم', category: 'shomiz', color: 'cream', image: '/images/lookbook/shomiz-cream.avif' },
  { day: 'یکشنبه', title: 'مانتو سبز سدری', category: 'manto', color: 'sage', image: '/images/lookbook/manto-sage.avif' },
  { day: 'دوشنبه', title: 'شومیز رز خاکی', category: 'shomiz', color: 'rose', image: '/images/lookbook/shomiz-rose.avif' },
  { day: 'سه‌شنبه', title: 'مانتو مشکی', category: 'manto', color: 'black', image: '/images/lookbook/manto-black.avif' },
  { day: 'چهارشنبه', title: 'تیشرت آبی دودی', category: 'tshirt', color: 'blue', image: '/images/lookbook/tshirt-blue.avif' },
  { day: 'پنجشنبه', title: 'تیشرت سفید', category: 'tshirt', color: 'white', image: '/images/lookbook/tshirt-white.avif' }
];
