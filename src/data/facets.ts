import type { ProductColor } from '@/types/store';

/** Single source of truth for storefront, admin and API category hierarchy.
 * Keep legacy leaf slugs (shomiz, manto, tshirt) stable for existing products and links. */
export const categories = [
  { slug: 'pants', title: 'شلوار زنانه', description: 'از بگ و واید تا راسته و پارچه‌ای', children: [
    { slug: 'bag-pants', title: 'شلوار بگ' },
    { slug: 'semi-bag-pants', title: 'شلوار نیم‌بگ' },
    { slug: 'super-bag-pants', title: 'شلوار سوپربگ' },
    { slug: 'flare-bag-pants', title: 'شلوار فلر بگ' },
    { slug: 'bootcut-pants', title: 'شلوار بوتکات' },
    { slug: 'wide-pants', title: 'شلوار واید' },
    { slug: 'jorts', title: 'جورتس' },
    { slug: 'capri-pants', title: 'شلوار کاپری' },
    { slug: 'easy-pants', title: 'شلوار ایزی' },
    { slug: 'shorts', title: 'شلوارک زنانه' },
    { slug: 'tailored-pants', title: 'شلوار پارچه‌ای' },
    { slug: 'joggers', title: 'شلوار جاگر' },
    { slug: 'lounge-pants', title: 'شلوار خانگی و راحتی' },
    { slug: 'culottes', title: 'شلوار دامنی' },
    { slug: 'leggings-tights', title: 'لگ و جوراب‌شلواری' },
    { slug: 'straight-pants', title: 'شلوار راسته' },
    { slug: 'balloon-pants', title: 'شلوار بالونی' }
  ] },
  { slug: 'skirts', title: 'دامن زنانه', description: 'مدل‌های دامن برای استایل‌های مختلف', children: [] },
  { slug: 'trench', title: 'بارانی و ترنچ کت زنانه', description: 'لایه‌های سبک برای روزهای بارانی', children: [] },
  { slug: 'hoodie-dors', title: 'هودی و دورس زنانه', description: 'گرم و راحت برای هر روز', children: [
    { slug: 'hoodie', title: 'هودی زنانه' }, { slug: 'dors', title: 'دورس زنانه' }
  ] },
  { slug: 'sweatshirt-bomber', title: 'سویشرت و بامبر جکت', description: 'لایه‌های اسپرت و روزمره', children: [] },
  { slug: 'dress-kaftan-overall-maxi', title: 'پیراهن، کفتان، اورال و ماکسی', description: 'انتخاب‌های یک‌تکه و شیک', children: [] },
  { slug: 'blazer-suit', title: 'کت و کت‌شلوار زنانه', description: 'استایل‌های رسمی و نیمه‌رسمی', children: [] },
  { slug: 'crop-body-top', title: 'کراپ، بادی و تاپ', description: 'آیتم‌های سبک برای ترکیب استایل', children: [
    { slug: 'crop', title: 'کراپ' }, { slug: 'body', title: 'بادی' }, { slug: 'top', title: 'تاپ زنانه' }
  ] },
  { slug: 'coat-shacket', title: 'پالتو و شکت زنانه', description: 'برای روزهای سردتر', children: [] },
  { slug: 'jacket-puffer', title: 'کاپشن و پافر زنانه', description: 'پوشش گرم و کاربردی', children: [
    { slug: 'jacket', title: 'کاپشن زنانه' }, { slug: 'puffer', title: 'پافر زنانه' }
  ] },
  { slug: 'shomiz-vest', title: 'شومیز و وست زنانه', description: 'جزئیات ظریف برای استایل روزمره', children: [
    { slug: 'shomiz', title: 'شومیز' }, { slug: 'vest', title: 'وست زنانه' }
  ] },
  { slug: 'womens-clothing', title: 'لباس زنانه', description: 'دسته عمومی برای لباس‌های بدون گروه مشخص', children: [] },
  { slug: 'sets', title: 'ست زنانه', description: 'ست‌های هماهنگ و آماده', children: [] },
  { slug: 'manto', title: 'مانتو زنانه', description: 'مانتوهای راحت و امروزی', children: [] },
  { slug: 'knitwear', title: 'بافت زنانه', description: 'پوشاک بافت برای فصل‌های خنک', children: [] },
  { slug: 'tshirt-loungewear', title: 'تیشرت و لباس راحتی زنانه', description: 'انتخاب‌های ساده و راحت روزانه', children: [
    { slug: 'tshirt', title: 'تیشرت زنانه' }, { slug: 'loungewear', title: 'لباس راحتی زنانه' }
  ] }
] as const;

/** Every selectable category, including child categories. */
export const allCategories: { slug: CategorySlug; title: string; description: string }[] =
  categories.flatMap(group => [
    { slug: group.slug, title: group.title, description: group.description },
    ...group.children.map(child => ({ slug: child.slug, title: child.title, description: group.description }))
  ]);

export type CategorySlug = (typeof categories)[number]['slug'] | (typeof categories)[number]['children'][number]['slug'];

export const isCategorySlug = (slug: string): slug is CategorySlug =>
  allCategories.some(category => category.slug === slug);

/** A root category must include its own uncategorized items as well as all descendants. */
export function categoryFamily(slug: CategorySlug): CategorySlug[] {
  const group = categories.find(category => category.slug === slug);
  return group ? [group.slug, ...group.children.map(child => child.slug)] : [slug];
}

export const palette: ProductColor[] = [
  { id: 'cream', name: 'کرم', hex: '#e7d8c2' },
  { id: 'black', name: 'مشکی', hex: '#34312f' },
  { id: 'rose', name: 'رز خاکی', hex: '#b98a83' },
  { id: 'sage', name: 'سبز سدری', hex: '#84958a' },
  { id: 'blue', name: 'آبی دودی', hex: '#7c929d' },
  { id: 'white', name: 'سفید', hex: '#f6f3ed' }
];
export const standardSizes = ['S', 'M', 'L', 'XL'] as const;
