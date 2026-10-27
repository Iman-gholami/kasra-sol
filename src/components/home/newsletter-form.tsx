'use client';

import { useId, useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { normalizeMobile } from '@/components/checkout/fields';

/** The customer club's mobile field. There is no subscription service yet, so a valid number is checked and then
 * dropped (never stored or sent), and the confirmation says so plainly. Accepts Persian or Latin digits and +98. */
export function NewsletterForm() {
  const id = useId();
  const [value, setValue] = useState('');
  const [state, setState] = useState<'idle' | 'invalid' | 'done'>('idle');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^09\d{9}$/.test(normalizeMobile(value))) { setState('invalid'); return; }
    setValue('');
    setState('done');
  }

  return <form className="club-form" onSubmit={submit} noValidate>
    <label className="field-label" htmlFor={id + 'mobile'}>شماره موبایل</label>
    <div className="club-field">
      <input id={id + 'mobile'} className="control" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" enterKeyHint="send"
        placeholder="0912 345 6789" value={value} aria-invalid={state === 'invalid' || undefined}
        aria-describedby={state === 'invalid' ? id + 'error' : undefined}
        onChange={event => { setValue(event.target.value); if (state !== 'idle') setState('idle'); }}/>
      <button type="submit" className="btn btn-primary">عضویت</button>
    </div>
    {state === 'invalid' && <p className="field-error" id={id + 'error'} role="alert">
      <AlertCircle size={16} aria-hidden="true"/> شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.</p>}
    <p className="club-status" role="status">{state === 'done'
      ? 'این نسخه نمایشی است و شماره‌ات جایی ذخیره نشد. عضویت پیامکی پس از راه‌اندازی رسمی فعال می‌شود.' : ''}</p>
  </form>;
}
