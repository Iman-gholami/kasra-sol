/** The store's phone lines and social pages: one list, shown in the footer and on the contact page. Change a number
 * or an address here and both places follow. */
export type PhoneLine = { id: 'store' | 'support' | 'wholesale'; label: string; number: string };
export type SocialLink = { id: 'instagram' | 'bale'; label: string; href: string };

export const PHONE_LINES: readonly PhoneLine[] = [
  { id: 'store', label: 'فروشگاه', number: '02163128962' },
  { id: 'support', label: 'پشتیبانی', number: '09026450596' },
  { id: 'wholesale', label: 'فروش عمده', number: '09199181261' }
];

export const SOCIAL_LINKS: readonly SocialLink[] = [
  { id: 'instagram', label: 'اینستاگرام', href: 'https://www.instagram.com/kasra_boutiquee/' },
  { id: 'bale', label: 'کانال بله', href: 'https://ble.ir/kasraboutique' }
];
