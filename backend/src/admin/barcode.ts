/** EAN-13 check digit of the first 12 digits: weights 1 and 3 alternate from the left. */
export function ean13CheckDigit(first12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 ? 3 : 1);
  return String((10 - sum % 10) % 10);
}

/** A code this shop printed: EAN-13 in prefix 20, GS1's range for numbers used only inside one store, with a
 * valid check digit (a mistyped or misread digit fails it). */
export const isStoreBarcode = (code: string) =>
  /^20\d{11}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === code[12];

/** The shop's barcode for a sequence number: digits only, so a USB scanner types it correctly even while the
 * computer's keyboard is set to Persian (letters would arrive as Persian characters). */
export function storeBarcode(sequence: number) {
  const body = '20' + String(sequence).padStart(10, '0');
  if (!Number.isSafeInteger(sequence) || sequence < 1 || body.length !== 12) throw new RangeError('Barcode sequence out of range');
  return body + ean13CheckDigit(body);
}
