import type { Metadata } from 'next';
import { WishlistPage } from '@/components/wishlist-page';
export const metadata: Metadata = { title: 'علاقه‌مندی‌ها', robots: { index: false, follow: false } };
export default function Page() { return <WishlistPage />; }
