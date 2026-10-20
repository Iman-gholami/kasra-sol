import type { ReactNode } from 'react';
import '@/styles/admin.css';

/** Back-office styles load only on /admin routes, so shoppers never download them. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
