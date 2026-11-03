import { toPersianDigits } from '@/lib/format';

/** Iranian numbers as written at home: 11 digits starting with 0. Mobiles start 09, landlines 0 plus a city code. */
const NATIONAL = /^0[1-9]\d{9}$/;

function national(number: string) {
  if (!NATIONAL.test(number)) throw new Error('Not an 11-digit Iranian phone number: ' + number);
  return number;
}

/** The dialable link, in international form so it also works from a phone with a foreign SIM: 021… → tel:+9821…. */
export const telHref = (number: string): string => 'tel:+98' + national(number).slice(1);

/** The number as people read it aloud, in Persian digits: mobiles 0912 345 6789, landlines 021 1234 5678. */
export function displayPhone(number: string): string {
  const digits = national(number);
  const groups = digits.startsWith('09') ? [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)]
    : [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7)];
  return toPersianDigits(groups.join(' '));
}
