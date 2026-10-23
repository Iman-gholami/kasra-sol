import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin/login-form';

export const metadata: Metadata = { title: 'ورود به مدیریت فروشگاه', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  // Show only the isolated sample-data demo in Vercel previews without an admin backend.
  if (process.env.VERCEL_ENV === 'preview' && !process.env.BACKEND_INTERNAL_URL) redirect('/admin/demo');
  return <AdminLoginForm expired={(await searchParams).expired === '1'}/>;
}
