'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react';

const FAILURES: Record<number, string> = {
  401: 'نام کاربری یا رمز عبور درست نیست. پس از چند تلاش ناموفق، ورود به این حساب برای مدتی مسدود می‌شود.',
  429: 'تعداد تلاش‌های ورود زیاد بوده است؛ یک دقیقه صبر کنید و دوباره تلاش کنید.',
  403: 'درخواست ورود از نشانی نامعتبر بود؛ صفحه را تازه کنید.'
};

export function AdminLoginForm({ expired }: { expired: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
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
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(FAILURES[response.status] ?? (body.error === 'https_required'
          ? 'ورود به پنل فقط از طریق HTTPS مجاز است.' : 'ورود ممکن نشد؛ اتصال به سرور را بررسی کنید.'));
      }
      setPassword('');
      router.replace('/admin');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خطا در ورود');
      setBusy(false);
    }
  }
  return <section className="admin-login">
    <div className="admin-login-card">
      <div className="admin-login-mark" aria-hidden="true">K</div>
      <h1>ورود به مدیریت فروشگاه</h1>
      <p className="admin-login-desc">پنل اختصاصی کسری بوتیک · ویژه صاحب فروشگاه و کارکنان</p>
      {expired && !message && <p role="status" className="admin-login-info">نشست شما به پایان رسیده است؛ دوباره وارد شوید.</p>}
      <form className="admin-login-form" onSubmit={submit}>
        <label>نام کاربری
          <input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)}
            required minLength={3} maxLength={64} dir="ltr" autoCapitalize="none" spellCheck={false} autoFocus/>
        </label>
        <div className="admin-login-field">
          <label htmlFor="admin-password">رمز عبور</label>
          <span className="admin-password">
            <input id="admin-password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password}
              onChange={event => setPassword(event.target.value)} required maxLength={256} dir="ltr"/>
            <button type="button" className="admin-password-toggle" onClick={() => setVisible(v => !v)}
              aria-label="نمایش رمز" aria-pressed={visible} aria-controls="admin-password">
              {visible ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
            </button>
          </span>
        </div>
        {message && <p role="alert" className="admin-login-error">{message}</p>}
        <button type="submit" disabled={busy} className="admin-btn admin-btn-primary">
          <LockKeyhole size={17} aria-hidden="true"/> {busy ? 'در حال بررسی…' : 'ورود به پنل مدیریت'}
        </button>
      </form>
      <div className="admin-login-foot">
        <Link href="/"><ArrowLeft size={15} aria-hidden="true"/> بازگشت به فروشگاه</Link>
      </div>
    </div>
  </section>;
}
