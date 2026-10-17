'use client';

import { useId, useRef, useState } from 'react';
import { AlertCircle, BadgePercent, Tag } from 'lucide-react';
import { applyDiscount, discountCodes } from '@/lib/checkout';

/** Discount code, inline in the cart: field and button side by side, errors and the sample codes below.
 * Enter applies the code; an applied code shows as a removable chip and is re-checked as the cart changes. */
export function DiscountField({ applied, subtotal, onChange }: { applied: string; subtotal: number; onChange: (code: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const result = applied ? applyDiscount(applied, subtotal) : null;

  function apply() {
    const next = applyDiscount(value, subtotal);
    if (!next.ok) { setError(next.message); input.current?.focus(); return; }
    setError('');
    setValue('');
    onChange(next.code);
  }

  if (applied && result) return <div className={'discount-applied' + (result.ok ? '' : ' is-invalid')} role="status">
    <Tag size={18} aria-hidden="true"/>
    <span>{result.ok
      ? <>کد <bdi dir="ltr">{applied}</bdi> اعمال شد: {result.label}</>
      : <>کد <bdi dir="ltr">{applied}</bdi> دیگر برای این سبد معتبر نیست. {result.message}</>}</span>
    <button type="button" className="link-button" onClick={() => {
      onChange('');
      requestAnimationFrame(() => input.current?.focus());
    }}>حذف کد</button>
  </div>;

  return <div className="discount-box">
    <label className="sr-only" htmlFor={id + '-input'}>کد تخفیف</label>
    <div className="discount-row">
      <input ref={input} id={id + '-input'} className="control" value={value} placeholder="کد تخفیف را وارد کن"
        autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done"
        aria-invalid={Boolean(error)} aria-describedby={id + (error ? '-error' : '-hint')}
        onChange={event => { setValue(event.target.value); if (error) setError(''); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); apply(); } }}/>
      <button type="button" className="btn btn-secondary discount-apply" onClick={apply}>
        <BadgePercent size={18} aria-hidden="true"/> ثبت کد
      </button>
    </div>
    {error
      ? <p className="field-error" id={id + '-error'}><AlertCircle size={16} aria-hidden="true"/>{error}</p>
      : <p className="field-hint" id={id + '-hint'}>
        کدهای آزمایشی: {discountCodes.map((entry, index) => <span key={entry.code}>{index ? '، ' : ''}<bdi dir="ltr">{entry.code}</bdi></span>)}
      </p>}
  </div>;
}
