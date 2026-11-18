/** Helpers that let the product editor ask only for what a shop owner knows (a Persian name, a colour, sizes) and
 * work out the Latin identifiers the API and the storefront addresses need. */

// Persian letters → Latin, roughly as people write Persian in Latin letters (Finglish). Short vowels are not
// written in Persian, so the result is readable rather than exact: «مانتو لینن» → «manto-linn».
const LETTERS: Record<string, string> = {
  'ا': 'a', 'آ': 'a', 'أ': 'a', 'إ': 'e', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h',
  'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't',
  'ظ': 'z', 'ع': '', 'غ': 'gh', 'ف': 'f', 'ق': 'gh', 'ک': 'k', 'ك': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ؤ': 'o', 'ئ': 'y', 'ء': '', 'ة': 'e'
};
const DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function word(text: string) {
  let out = '';
  const chars = [...text];
  chars.forEach((char, index) => {
    const first = index === 0, last = index === chars.length - 1;
    if (/[a-z0-9]/.test(char)) out += char;
    else if (DIGITS.includes(char)) out += DIGITS.indexOf(char);
    else if (ARABIC_DIGITS.includes(char)) out += ARABIC_DIGITS.indexOf(char);
    // و starts a word as «v» (ورزشی) and is a vowel inside one (مانتو, شومیز).
    else if (char === 'و') out += first ? 'v' : 'o';
    // ی/ي starts a word as «y» (یقه) and is «i» elsewhere (لینن, شومیز).
    else if (char === 'ی' || char === 'ي' || char === 'ى') out += first ? 'y' : 'i';
    // A final ه is usually the «e» sound (یقه, دکمه).
    else if (char === 'ه') out += last && !first ? 'e' : 'h';
    else out += LETTERS[char] ?? '-';
  });
  return out;
}

/** A Latin address part (lower case letters, digits and hyphens) for a Persian or Latin name, '' if nothing is left. */
export function latinSlug(name: string, maxLength = 79): string {
  const words = name.normalize('NFKC').toLowerCase()
    // Zero-width non-joiner, spaces and punctuation separate words: «یقه‌دار» → «yghe-dar».
    .split(/[\s‌‏‎_\-–—،,.؛;:/\\()[\]{}«»"'!?؟+*&%#@|<>=~`^]+/u)
    .map(word).join('-');
  return words.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, maxLength).replace(/-$/, '');
}

const IDENT = /^[a-z0-9][a-z0-9-]{1,78}$/;
/** `base` if it is a valid identifier not yet in `taken`, otherwise `base-2`, `base-3`…; `fallback` stands in for an
 * empty or too short base. */
export function uniqueIdent(base: string, taken: Iterable<string>, fallback: string): string {
  const used = new Set(taken);
  const root = IDENT.test(base) ? base : fallback;
  if (!used.has(root)) return root;
  for (let n = 2; ; n++) {
    const candidate = root.slice(0, 79 - String(n).length - 1) + '-' + n;
    if (!used.has(candidate)) return candidate;
  }
}

/** The address of a new product: its Latin name, or the category and a number when the name has no letters. */
export function suggestedAddress(name: string, category: string): string {
  const slug = latinSlug(name);
  return slug.length >= 2 ? slug : category + '-' + String(Date.now()).slice(-5);
}

export type PresetColor = { id: string; name: string; hex: string; familyId?: string };
/** Common clothing colours, so a colour is picked rather than typed with a Latin code. `familyId` puts a shade into one
 * of the storefront's «خرید بر اساس رنگ» groups (cream, black, rose, sage, blue, white); the others form their own. */
export const COLOR_PRESETS: PresetColor[] = [
  { id: 'black', name: 'مشکی', hex: '#1f1f1f' },
  { id: 'white', name: 'سفید', hex: '#f8f6f1' },
  { id: 'cream', name: 'کرم', hex: '#e7d8c2' },
  { id: 'beige', name: 'بژ', hex: '#d8c3a5', familyId: 'cream' },
  { id: 'gray', name: 'طوسی', hex: '#9a9a9a' },
  { id: 'charcoal', name: 'ذغالی', hex: '#3d3f42', familyId: 'black' },
  { id: 'navy', name: 'سرمه‌ای', hex: '#24324f', familyId: 'blue' },
  { id: 'blue', name: 'آبی', hex: '#5a7fa8' },
  { id: 'sky-blue', name: 'آبی آسمانی', hex: '#9cc3e0', familyId: 'blue' },
  { id: 'sage', name: 'سبز سدری', hex: '#84958a' },
  { id: 'green', name: 'سبز', hex: '#3f7a52', familyId: 'sage' },
  { id: 'olive', name: 'زیتونی', hex: '#6b6a3a', familyId: 'sage' },
  { id: 'brown', name: 'قهوه‌ای', hex: '#6b4a32' },
  { id: 'camel', name: 'شتری', hex: '#b88a5a' },
  { id: 'pink', name: 'صورتی', hex: '#e8a5b8', familyId: 'rose' },
  { id: 'rose', name: 'رز خاکی', hex: '#b98a83' },
  { id: 'peach', name: 'گلبهی', hex: '#f0b49e', familyId: 'rose' },
  { id: 'red', name: 'قرمز', hex: '#b3262e' },
  { id: 'maroon', name: 'زرشکی', hex: '#6e1f2b' },
  { id: 'purple', name: 'بنفش', hex: '#6a4c93' },
  { id: 'lilac', name: 'یاسی', hex: '#b9a3d0' },
  { id: 'yellow', name: 'زرد', hex: '#e9c547' },
  { id: 'mustard', name: 'خردلی', hex: '#c49a2c' },
  { id: 'orange', name: 'نارنجی', hex: '#e07b39' }
];

/** Size buttons, in the order the storefront lists them. */
export const SIZE_GROUPS: { title: string; sizes: string[] }[] = [
  { title: 'حروفی', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] },
  { title: 'عددی', sizes: ['36', '38', '40', '42', '44', '46', '48', '50', '52'] },
  { title: 'تک‌سایز', sizes: ['فری‌سایز'] }
];
const SIZE_ORDER = SIZE_GROUPS.flatMap(group => group.sizes);
/** `sizes` with the preset ones in their usual order and any other size after them, as entered. */
export function orderSizes(sizes: string[]): string[] {
  const unique = [...new Set(sizes.map(size => size.trim()).filter(Boolean))];
  const known = unique.filter(size => SIZE_ORDER.includes(size)).sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  return [...known, ...unique.filter(size => !SIZE_ORDER.includes(size))];
}

/** Common answers offered (not imposed) for the text fields every product needs. */
export const SUGGESTIONS = {
  material: ['نخ پنبه', 'کتان', 'لینن', 'ویسکوز', 'کرپ', 'حریر', 'ساتن', 'مازراتی', 'جین', 'پارچه بافت', 'پلی‌استر', 'نخ و پلی‌استر'],
  fit: ['آزاد', 'راسته', 'جذب', 'نیمه‌جذب', 'اورسایز', 'کمردار', 'کلوش'],
  care: ['شست‌وشو با آب سرد، اتو با حرارت ملایم', 'شست‌وشوی دستی با آب ولرم', 'فقط خشک‌شویی', 'با رنگ‌های مشابه شسته شود؛ سفیدکننده نزنید']
};

/** Whole-percent discount shown to shoppers when a «before» price is set, or null. */
export function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price || price <= 0) return null;
  return Math.round((1 - price / compareAt) * 100);
}
