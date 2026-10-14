import Link from 'next/link';
import { activeAnnouncement } from '@/data/announcements';

/** Server-rendered strip above the header: one configured message, fixed height, no rotation or timers.
 * Renders nothing when no announcement is enabled, so the header moves up without leaving a gap. */
export function AnnouncementBar() {
  const announcement = activeAnnouncement();
  if (!announcement) return null;
  return <aside className="announcement" aria-label="اطلاعیه فروشگاه">
    <p>{announcement.href
      ? <Link href={announcement.href}>{announcement.message}</Link>
      : announcement.message}</p>
  </aside>;
}
