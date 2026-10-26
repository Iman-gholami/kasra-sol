// EAN-13 symbol encoding (ISO/IEC 15420). Each digit is 7 modules; L/G/R are the three digit sets.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map(code => [...code].map(bit => bit === '1' ? '0' : '1').join(''));
const G = R.map(code => [...code].reverse().join(''));
// The first digit is not drawn: it selects which of the next six digits use set G instead of L.
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** 13 digits whose last one is the EAN-13 check digit (weights 1 and 3 alternate from the left). */
export function isEan13(code: string) {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = [...code.slice(0, 12)].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === Number(code[12]);
}

/** The 95 modules of an EAN-13 symbol as '1' (bar) and '0' (space), without quiet zones. */
export function ean13Modules(code: string) {
  if (!/^\d{13}$/.test(code)) throw new RangeError('EAN-13 needs 13 digits');
  const digits = [...code].map(Number);
  const left = digits.slice(1, 7).map((digit, i) => (PARITY[digits[0]][i] === 'G' ? G : L)[digit]).join('');
  const right = digits.slice(7).map(digit => R[digit]).join('');
  return '101' + left + '01010' + right + '101';
}

/** Bars as [start module, width] runs, for drawing one rectangle per bar. */
export function ean13Bars(code: string) {
  const modules = ean13Modules(code);
  const bars: [number, number][] = [];
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] !== '1') continue;
    const start = i;
    while (modules[i + 1] === '1') i++;
    bars.push([start, i - start + 1]);
  }
  return bars;
}
