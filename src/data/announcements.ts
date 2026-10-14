/** Site-wide announcement strip. One message is shown at a time: the enabled entry with the highest priority.
 * Only verified statements belong here; never shipping times, return terms or discount eligibility that the
 * business has not confirmed. A CMS or campaign source can later return this same shape. */
export type Announcement = {
  id: string;
  message: string;
  /** Optional destination; the whole message becomes a link. */
  href?: string;
  enabled: boolean;
  /** Higher wins; defaults to 0. */
  priority?: number;
};

export const announcements: Announcement[] = [
  // The storefront is a demo: this is the one verified, customer-relevant fact we can state.
  { id: 'demo-status', message: 'نسخه نمایشی؛ پرداخت و ثبت سفارش واقعی فعال نیست', enabled: true, priority: 10 },
  // Neutral fallback for when the demo notice is retired and no campaign message is configured.
  { id: 'welcome', message: 'به Kasra Boutique خوش اومدی', enabled: true, priority: 0 }
];

export function activeAnnouncement(list: readonly Announcement[] = announcements): Announcement | undefined {
  return list.filter(item => item.enabled).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
}
