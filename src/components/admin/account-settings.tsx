'use client';

import { useState, type FormEvent } from 'react';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { PERMISSION, ROLE } from '@/components/admin/labels';
import { Notice } from '@/components/admin/ui';
import type { AdminUser } from '@/components/admin/admin-dashboard';

export function AccountSettings({ user }: { user: AdminUser }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next !== repeat) { setState({ tone: 'error', text: 'تکرار رمز جدید با خود آن یکسان نیست.' }); return; }
    setBusy(true); setState(null);
    try {
      await adminApi('auth/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      setCurrent(''); setNext(''); setRepeat('');
      setState({ tone: 'success', text: 'رمز عبور تغییر کرد. نشست‌های دیگر این حساب (در دستگاه‌های دیگر) بسته شدند.' });
    } catch (error) { setState({ tone: 'error', text: errorMessage(error) }); }
    finally { setBusy(false); }
  }
  return <div className="admin-stack admin-narrow">
    <section className="admin-panel" aria-labelledby="account-title">
      <div className="admin-panel-head"><div><h2 id="account-title">حساب من</h2>
        <p>{user.displayName} · <bdi dir="ltr">{user.username}</bdi> · {ROLE[user.role]}</p></div></div>
      <div className="admin-panel-body">
        <h3 className="admin-section-title">دسترسی‌های این حساب</h3>
        <ul className="admin-chip-list">
          {user.permissions.filter(p => PERMISSION[p]).map(p => <li key={p}>{PERMISSION[p].label}</li>)}
          {user.permissions.includes('staff:manage') && <li>مدیریت کارکنان</li>}
        </ul>
      </div>
    </section>
    <form className="admin-panel" onSubmit={submit} aria-labelledby="password-title">
      <div className="admin-panel-head"><div><h2 id="password-title">تغییر رمز عبور</h2>
        <p>رمز تازه باید حداقل ۱۲ نویسه و متفاوت از رمزهای دیگر شما باشد.</p></div></div>
      <div className="admin-panel-body admin-stack-sm">
        <label className="admin-field">رمز فعلی
          <input type="password" dir="ltr" required autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)}/>
        </label>
        <label className="admin-field">رمز جدید
          <input type="password" dir="ltr" required minLength={12} maxLength={256} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)}/>
        </label>
        <label className="admin-field">تکرار رمز جدید
          <input type="password" dir="ltr" required minLength={12} maxLength={256} autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)}/>
        </label>
        {state && <Notice tone={state.tone}>{state.text}</Notice>}
        <div className="admin-actions"><button type="submit" disabled={busy} className="admin-btn admin-btn-primary">
          {busy ? 'در حال ثبت…' : 'تغییر رمز عبور'}</button></div>
      </div>
    </form>
  </div>;
}
