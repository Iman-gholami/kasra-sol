import type { CategorySlug, Product, ProductColor } from '@/types/store';

export const categories: { slug: CategorySlug; title: string; description: string }[] = [
  { slug: 'shomiz', title: 'شومیز', description: 'جزئیات ظریف برای استایل روزمره و مهمانی' },
  { slug: 'manto', title: 'مانتو', description: 'لایه‌های راحت، خوش‌فرم و امروزی' },
  { slug: 'tshirt', title: 'تیشرت', description: 'انتخاب‌های ساده برای هر روز' }
];

const palette: ProductColor[] = [
  { id: 'cream', name: 'کرم', hex: '#e7d8c2' },
  { id: 'black', name: 'مشکی', hex: '#34312f' },
  { id: 'rose', name: 'رز خاکی', hex: '#b98a83' },
  { id: 'sage', name: 'سبز سدری', hex: '#84958a' },
  { id: 'blue', name: 'آبی دودی', hex: '#7c929d' },
  { id: 'white', name: 'سفید', hex: '#f6f3ed' }
];

const collections: {
  slug: CategorySlug;
  names: string[];
  material: string;
  fit: string;
  basePrice: number;
  increment: number;
}[] = [
  {
    slug: 'shomiz', material: 'نخ پنبه و ویسکوز', fit: 'فرم آزاد',
    basePrice: 589000, increment: 43000,
    names: ['شومیز لینن آوید', 'شومیز یقه‌دار مهتاب', 'شومیز آستین پفی روژ', 'شومیز نخی دریا',
      'شومیز راه‌راه النا', 'شومیز ساده ویانا', 'شومیز گره‌ای آتنا', 'شومیز کژوال رها',
      'شومیز دکمه‌دار آیلین', 'شومیز آستین‌بلند صدف', 'شومیز رمانتیک مانلی', 'شومیز مینیمال نیلا']
  },
  {
    slug: 'manto', material: 'کتان سبک و لینن ترکیبی', fit: 'راسته و راحت',
    basePrice: 1090000, increment: 79000,
    names: ['مانتو کتی سارا', 'مانتو لینن ارغوان', 'مانتو کوتاه ژیوا', 'مانتو دکمه‌دار آوا',
      'مانتو بهاره سپیدار', 'مانتو جلوباز آفتاب', 'مانتو مینیمال آناهید', 'مانتو کمر‌دار نوا',
      'مانتو شهری آرام', 'مانتو کتان پرنیان', 'مانتو اورسایز باران', 'مانتو راسته تارا']
  },
  {
    slug: 'tshirt', material: 'پنبه نرم', fit: 'نیمه‌آزاد',
    basePrice: 329000, increment: 27000,
    names: ['تیشرت بیسیک سپید', 'تیشرت آزاد هیوا', 'تیشرت یقه‌گرد آدرین', 'تیشرت نخی آلاله',
      'تیشرت اورسایز لونا', 'تیشرت روزمره تندیس', 'تیشرت مینیمال ترنج', 'تیشرت یقه‌هفت نیکی',
      'تیشرت آستین‌کوتاه لیلا', 'تیشرت ساده شایلین', 'تیشرت پنبه‌ای الناز', 'تیشرت کلاسیک مهر']
  }
];

export const products: Product[] = collections.flatMap((collection, categoryIndex) =>
  collection.names.map((name, i) => {
    const index = i + 1;
    const colorList = [
      palette[(i + categoryIndex) % palette.length],
      palette[(i + categoryIndex + 2) % palette.length],
      palette[(i + categoryIndex + 4) % palette.length]
    ];
    const sizes = ['S', 'M', 'L', 'XL'];
    const price = collection.basePrice + i * collection.increment;
    const slug = collection.slug + '-' + String(index).padStart(2, '0');
    return {
      id: slug,
      slug,
      name,
      category: collection.slug,
      price,
      compareAt: i % 4 === 0 ? Math.ceil(price * 1.2 / 10000) * 10000 : undefined,
      description: name + ' با طراحی ساده و جزئیات کاربردی، برای ساختن استایلی شخصی و راحت. تصاویر، قیمت‌ها و مشخصات در این نسخه نمایشی هستند.',
      images: ['/images/' + slug + '.svg', '/images/' + slug + '-detail.svg'],
      colors: colorList,
      sizes,
      variants: colorList.flatMap((color, colorIndex) =>
        sizes.map((size, sizeIndex) => ({
          colorId: color.id,
          size,
          stock: (i + colorIndex + sizeIndex) % 7 === 0 ? 0 : 2 + (i + sizeIndex) % 8
        }))
      ),
      material: collection.material,
      fit: collection.fit,
      care: 'شست‌وشو با آب سرد و شوینده ملایم؛ از خشک‌کن با حرارت بالا استفاده نشود.',
      createdAt: new Date(Date.UTC(2026, 8, 30 - i - categoryIndex * 2)).toISOString(),
      featured: i < 5 || i % 6 === 0
    };
  })
);

export const bySlug = (slug: string): Product | undefined =>
  products.find((product) => product.slug === slug);
export const byId = (id: string): Product | undefined =>
  products.find((product) => product.id === id);
export const getCategory = (slug: string) =>
  categories.find((category) => category.slug === slug);
export const getVariant = (product: Product, colorId: string, size: string) =>
  product.variants.find((variant) => variant.colorId === colorId && variant.size === size);
