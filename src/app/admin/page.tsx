import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AdminDashboard, type AdminUser } from '@/components/admin/admin-dashboard';

export const metadata: Metadata = { title: 'مدیریت فروشگاه', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  const token = (await cookies()).get('kasra_admin')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect('/admin/login');
  const internal = process.env.BACKEND_INTERNAL_URL;
  if (!internal) return <section className="container py-12" role="alert">ارتباط با بک‌اند مدیریت تنظیم نشده است.</section>;
  let user: AdminUser;
  try {
    const response = await fetch(internal + '/v1/admin/auth/me', {
      headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', signal: AbortSignal.timeout(10000)
    });
    if (response.status === 401) redirect('/admin/login');
    if (!response.ok) throw new Error('Admin backend unavailable');
    user = (await response.json()).user as AdminUser;
  } catch (error) {
    // Next.js redirect intentionally throws; do not swallow its routing signal.
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    return <section className="container py-12" role="alert">ارتباط با سرور مدیریت برقرار نشد. دوباره تلاش کنید.</section>;
  }
  return <AdminDashboard user={user}/>;
}
