'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LockKeyhole, ArrowLeft } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password })
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'نام کاربری یا رمز عبور درست نیست.' : 'ورود ممکن نشد. تنظیمات HTTPS و اتصال سرور را بررسی کنید.');
      setPassword('');
      router.replace('/admin');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خطا در ورود');
    } finally { setBusy(false); }
  }
  return <section className="admin-login">
    <div className="admin-login-card">
      <div className="admin-login-mark" aria-hidden="true">K</div>
      <h1>ورود به مدیریت فروشگاه</h1>
      <p className="admin-login-desc">پنل اختصاصی کسری بوتیک · ویژه صاحب فروشگاه و کارکنان</p>
      <form className="grid gap-5" onSubmit={submit}>
        <label>نام کاربری
          <input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)}
            required minLength={3} dir="ltr" placeholder="username"/>
        </label>
        <label>رمز عبور
          <input type="password" autoComplete="current-password" value={password}
            onChange={event => setPassword(event.target.value)}
            required dir="ltr" placeholder="••••••••••••"/>
        </label>
        {message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{message}</p>}
        <button type="submit" disabled={busy} className="admin-btn admin-btn-primary">
          <LockKeyhole size={17} aria-hidden="true"/> {busy ? 'در حال بررسی…' : 'ورود به پنل مدیریت'}
        </button>
      </form>
      <div className="mt-7 border-t border-slate-100 pt-5 text-center">
        <Link href="/" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-teal-800">
          <ArrowLeft size={15} aria-hidden="true"/> بازگشت به فروشگاه
        </Link>
      </div>
    </div>
  </section>;
}
