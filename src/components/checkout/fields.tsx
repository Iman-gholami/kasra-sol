'use client';

import { useId, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { formatNumber, toLatinDigits } from '@/lib/format';
import type { Field, Fields } from '@/components/checkout/checkout-storage';

export const provinces = ['تهران', 'اصفهان', 'فارس', 'خراسان رضوی', 'البرز', 'گیلان', 'مازندران', 'آذربایجان شرقی', 'خوزستان', 'سایر استان‌ها'];
/** Fields in the order the form shows them; the optional note is checked only for its length. */
export const addressOrder: Field[] = ['name', 'mobile', 'province', 'city', 'address', 'postal', 'notes'];
/** The longest text the order API accepts for each free-text field. */
export const FIELD_MAX_LENGTH: Partial<Record<Field, number>> = { name: 160, city: 80, address: 600, notes: 500 };
export const sampleFields: Fields = { name: 'مهمان نمایشی', mobile: '09120000000', province: 'تهران', city: 'تهران',
  address: 'خیابان نمونه، کوچه آزمایشی، پلاک ۱۰، واحد ۲', postal: '1234567890', notes: '' };

/** Persian, Arabic or Latin digits; spaces, dashes and an Iranian +98/0098 prefix are tolerated. */
export function normalizeMobile(value: string) {
  let digits = toLatinDigits(value).replace(/[\s\-()]/g, '');
  if (digits.startsWith('+98')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('0098')) digits = '0' + digits.slice(4);
  else if (/^98\d{10}$/.test(digits)) digits = '0' + digits.slice(2);
  else if (/^9\d{9}$/.test(digits)) digits = '0' + digits;
  return digits;
}
export const normalizePostal = (value: string) => toLatinDigits(value).replace(/[\s-]/g, '');

export function validate(field: Field, fields: Fields): string | undefined {
  const value = fields[field].trim();
  // The API trims every field except the note before measuring it.
  const limit = FIELD_MAX_LENGTH[field];
  if (limit && (field === 'notes' ? fields.notes : value).length > limit)
    return 'حداکثر ' + formatNumber(limit) + ' حرف مجاز است؛ متن را کوتاه‌تر کن.';
  switch (field) {
    case 'name': return value.length < 3 ? 'نام و نام خانوادگی را کامل وارد کن.' : undefined;
    case 'mobile': return /^09\d{9}$/.test(normalizeMobile(value)) ? undefined : 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
    case 'province': return value ? undefined : 'استان را انتخاب کن.';
    case 'city': return value.length < 2 ? 'نام شهر را وارد کن.' : undefined;
    case 'address': return value.length < 12 ? 'نشانی را با جزئیات بیشتری بنویس (خیابان، کوچه، پلاک).' : undefined;
    case 'postal': return /^\d{10}$/.test(normalizePostal(value)) ? undefined : 'کد پستی باید ۱۰ رقم باشد.';
    default: return undefined;
  }
}
export const addressComplete = (fields: Fields) => addressOrder.every(field => !validate(field, fields));

type TextFieldProps = {
  label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; error?: string; hint?: string;
  optional?: boolean; multiline?: boolean; wide?: boolean; placeholder?: string; dir?: 'ltr'; maxLength?: number;
  type?: string; inputMode?: 'tel' | 'numeric' | 'text'; autoComplete?: string; enterKeyHint?: 'next' | 'done';
};

function FieldShell({ id, label, optional, error, hint, wide, children }: { id: string; label: string; optional?: boolean; error?: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return <div className={'field form-field' + (wide ? ' wide' : '')}>
    <label className="field-label" htmlFor={id}>{label}{optional && <span className="optional"> (اختیاری)</span>}</label>
    {children}
    {hint && !error && <p className="field-hint" id={id + '-hint'}>{hint}</p>}
    {error && <p className="field-error" id={id + '-error'}><AlertCircle size={16} aria-hidden="true"/>{error}</p>}
  </div>;
}

export function TextField({ label, value, onChange, onBlur, error, hint, optional, multiline, wide, placeholder, dir, maxLength, type = 'text', inputMode, autoComplete, enterKeyHint }: TextFieldProps) {
  const id = useId();
  const describedBy = error ? id + '-error' : hint ? id + '-hint' : undefined;
  const common = { id, value, placeholder, maxLength, autoComplete: autoComplete ?? 'off', 'aria-invalid': Boolean(error),
    'aria-describedby': describedBy, 'aria-required': optional ? undefined : true, onBlur,
    className: 'control' + (dir ? ' control-ltr' : '') };
  return <FieldShell id={id} label={label} optional={optional} error={error} hint={hint} wide={wide}>
    {multiline
      ? <textarea {...common} onChange={event => onChange(event.target.value)} rows={3}/>
      : <input {...common} type={type} dir={dir} inputMode={inputMode} enterKeyHint={enterKeyHint} onChange={event => onChange(event.target.value)}/>}
  </FieldShell>;
}

export function SelectField({ label, value, onChange, onBlur, error }: { label: string; value: string; onChange: (value: string) => void; onBlur: () => void; error?: string }) {
  const id = useId();
  return <FieldShell id={id} label={label} error={error}>
    <select id={id} className="control" value={value} onChange={event => onChange(event.target.value)} onBlur={onBlur}
      autoComplete="address-level1" aria-invalid={Boolean(error)} aria-required aria-describedby={error ? id + '-error' : undefined}>
      <option value="">انتخاب استان</option>
      {provinces.map(province => <option key={province} value={province}>{province}</option>)}
    </select>
  </FieldShell>;
}

/** Radio card: the whole card is the label, so the hit area is the full row. The radio is named by its title
 * and price only; the detail and, for a disabled option, the reason it is unavailable are its description. */
export function ChoiceCard({ name, value, checked, disabled, title, detail, aside, reason, onChange }: {
  name: string; value: string; checked: boolean; disabled?: boolean; title: string; detail: ReactNode; aside?: ReactNode;
  reason?: string; onChange: () => void;
}) {
  const id = useId();
  return <label className={'choice-card' + (checked ? ' is-checked' : '') + (disabled ? ' is-disabled' : '')}>
    <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange}
      aria-labelledby={id + '-title' + (aside ? ' ' + id + '-aside' : '')}
      aria-describedby={id + '-detail' + (reason ? ' ' + id + '-reason' : '')}/>
    <span className="choice-card-body">
      <span className="choice-card-title" id={id + '-title'}>{title}</span>
      <span className="choice-card-detail" id={id + '-detail'}>{detail}</span>
      {reason && <span className="choice-card-reason" id={id + '-reason'}>{reason}</span>}
    </span>
    {aside && <span className="choice-card-aside" id={id + '-aside'}>{aside}</span>}
  </label>;
}
