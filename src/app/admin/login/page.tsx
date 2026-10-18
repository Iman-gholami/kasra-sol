import type { Metadata } from 'next';
import { AdminLoginForm } from '@/components/admin/login-form';

export const metadata: Metadata = { title: 'ورود به مدیریت فروشگاه', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  return <AdminLoginForm expired={(await searchParams).expired === '1'}/>;
}
