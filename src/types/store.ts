export type CategorySlug = 'shomiz' | 'manto' | 'tshirt';

export type ProductColor = { id: string; name: string; hex: string; familyId?: string };
export type ProductVariant = { colorId: string; size: string; stock: number };

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  price: number;
  compareAt?: number;
  images: string[];
  /** Color-specific preview imagery keyed by actual variant color ID (when available). */
  colorPreviewImages?: Record<string, string>;
  colors: ProductColor[];
  sizes: string[];
  variants: ProductVariant[];
  material: string;
  fit: string;
  care: string;
  createdAt: string;
  featured: boolean;
};

export type CartItem = {
  productId: string;
  colorId: string;
  size: string;
  quantity: number;
};

export type CatalogFilters = {
  category?: CategorySlug;
  q?: string;
  size?: string;
  color?: string;
  min?: number;
  max?: number;
  inStock?: boolean;
  discounted?: boolean;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'featured';
  page?: number;
};
