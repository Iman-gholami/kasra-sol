'use client';

import { Minus, Plus } from 'lucide-react';
import { formatNumber } from '@/lib/format';

type Props = {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  /** Appended to the button names, e.g. the product name in a cart line. */
  itemLabel?: string;
  size?: 'md' | 'lg';
};

/** Shared stepper: increase sits at the inline start (right in RTL), as Persian readers expect "+" first. */
export function QuantityStepper({ value, min = 1, max, onChange, itemLabel, size = 'md' }: Props) {
  const suffix = itemLabel ? ' ' + itemLabel : '';
  return <div className={'qty-stepper' + (size === 'lg' ? ' qty-stepper-lg' : '')} role="group" aria-label={'تعداد' + suffix}>
    <button type="button" aria-label={'افزایش تعداد' + suffix} disabled={value >= max} onClick={() => onChange(value + 1)}>
      <Plus size={18} aria-hidden="true"/>
    </button>
    <span aria-live="polite" aria-atomic="true">{formatNumber(value)}</span>
    <button type="button" aria-label={'کاهش تعداد' + suffix} disabled={value <= min} onClick={() => onChange(value - 1)}>
      <Minus size={18} aria-hidden="true"/>
    </button>
  </div>;
}
