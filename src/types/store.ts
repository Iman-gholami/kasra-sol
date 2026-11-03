export type CategorySlug = 'shomiz' | 'manto' | 'tshirt';

export type ProductColor = { id: string; name: string; hex: string; familyId?: string };
/** `price`/`compareAt` are present only when the last-piece discount changes this variant's price (its own stock is
 * exactly 1); otherwise the variant sells at the product's price. */
export type ProductVariant = { colorId: string; size: string; stock: number; price?: number; compareAt?: number };

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  price: number;
  compareAt?: number;
  images: string[];
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
  /** Models down to their last unit (stock across every colour and size adds up to one): `last=1`. */
  lastPiece?: boolean;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'featured';
  page?: number;
};
