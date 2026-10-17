'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

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
  return <section className="mx-auto my-12 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
    <h1 className="mb-2 text-2xl font-bold">ورود به مدیریت فروشگاه</h1>
    <p className="mb-6 text-sm text-neutral-600">هر کارمند باید با حساب شخصی خودش وارد شود.</p>
    <form className="grid gap-4" onSubmit={submit}>
      <label className="grid gap-2">نام کاربری
        <input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)}
          required minLength={3} className="rounded-md border border-neutral-400 p-3" dir="ltr"/>
      </label>
      <label className="grid gap-2">رمز عبور
        <input type="password" autoComplete="current-password" value={password}
          onChange={event => setPassword(event.target.value)}
          required className="rounded-md border border-neutral-400 p-3" dir="ltr"/>
      </label>
      {message && <p role="alert" className="text-red-700">{message}</p>}
      <button type="submit" disabled={busy} className="rounded-md bg-neutral-900 p-3 text-white disabled:opacity-50">
        {busy ? 'در حال بررسی…' : 'ورود امن'}
      </button>
    </form>
  </section>;
}
