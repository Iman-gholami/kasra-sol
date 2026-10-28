'use client';

import { forwardRef, useState, type FormEvent } from 'react';
import { ScanBarcode } from 'lucide-react';
import { isEan13 } from '@/lib/ean13';
import { digitsOnly } from '@/components/admin/labels';

/** Why a typed or scanned value is not a label barcode, or null when it is one. */
export function barcodeProblem(code: string) {
  if (code.length !== 13) return 'بارکد ۱۳ رقم است؛ دوباره اسکن کنید یا عدد زیر بارکد را کامل بنویسید.';
  if (!isEan13(code)) return 'یکی از رقم‌ها درست خوانده یا تایپ نشده است (رقم کنترل بارکد نمی‌خواند)؛ دوباره اسکن کنید.';
  return null;
}

/** A USB or Bluetooth barcode scanner types the digits and presses Enter, like a keyboard. With the computer set
 * to Persian the digits arrive as ۰-۹, so they are converted; the field empties itself for the next scan. */
export const ScanField = forwardRef<HTMLInputElement, {
  label: string; hint: string; onCode: (code: string) => void;
}>(function ScanField({ label, hint, onCode }, ref) {
  const [value, setValue] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const code = digitsOnly(value);
    setValue('');
    if (code) onCode(code);
  }
  return <form className="admin-scan" onSubmit={submit}>
    <label className="admin-field">
      <span className="admin-scan-label"><ScanBarcode size={18} aria-hidden="true"/> {label}</span>
      <input ref={ref} type="text" inputMode="numeric" autoComplete="off" enterKeyHint="done" dir="ltr" maxLength={40}
        value={value} onChange={event => setValue(event.target.value)}/>
      <small>{hint}</small>
    </label>
    <button type="submit" className="admin-btn admin-btn-outline" disabled={!value.trim()}>افزودن</button>
  </form>;
});
