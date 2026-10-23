import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AdminDashboard, type AdminUser } from '@/components/admin/admin-dashboard';
import { forwardedFor } from '@/lib/backend-proxy';

export const metadata: Metadata = { title: 'مدیریت فروشگاه', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; edit?: string; q?: string }> }) {
  // The preview has no backend: direct /admin visitors to sample-data-only UI instead of a broken login.
  if (process.env.VERCEL_ENV === 'preview' && !process.env.BACKEND_INTERNAL_URL) redirect('/admin/demo');
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
  const { tab, edit, q } = await searchParams;
  // Repeated parameters arrive as arrays; only plain strings are used, and the dashboard validates them.
  const one = (value: unknown) => typeof value === 'string' ? value : undefined;
  return <AdminDashboard user={user} initial={{ tab: one(tab), edit: one(edit), q: one(q) }}/>;
}
