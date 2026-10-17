import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AdminDashboard, type AdminUser } from '@/components/admin/admin-dashboard';
import { forwardedFor } from '@/lib/backend-proxy';

export const metadata: Metadata = { title: 'مدیریت فروشگاه', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const token = (await cookies()).get('kasra_admin')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect('/admin/login');
  const internal = process.env.BACKEND_INTERNAL_URL;
  if (!internal) return <section className="admin-login" role="alert"><div className="admin-login-card">ارتباط با بک‌اند مدیریت تنظیم نشده است.</div></section>;
  let user: AdminUser;
  try {
    const response = await fetch(internal + '/v1/admin/auth/me', {
      headers: { Authorization: 'Bearer ' + token, ...forwardedFor(await headers()) }, cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    });
    if (response.status === 401) redirect('/admin/login');
    if (!response.ok) throw new Error('Admin backend unavailable');
    user = (await response.json()).user as AdminUser;
  } catch (error) {
    // Next.js redirect intentionally throws; do not swallow its routing signal.
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    return <section className="admin-login" role="alert"><div className="admin-login-card">ارتباط با سرور مدیریت برقرار نشد. دوباره تلاش کنید.</div></section>;
  }
  return <AdminDashboard user={user} initialSection={(await searchParams).tab}/>;
}
