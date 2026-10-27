import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/** The home sections' heading: a light h2, an optional one-line note, and a "see all" link on the title's line. */
export function SectionHeading({ id, title, note, href, linkLabel }:
  { id: string; title: string; note?: string; href?: string; linkLabel?: string }) {
  return <div className="home-heading">
    <h2 id={id}>{title}</h2>
    {href && <Link className="text-link home-heading-link" href={href}>{linkLabel}<ArrowLeft size={16} aria-hidden="true"/></Link>}
    {note && <p className="home-heading-note">{note}</p>}
  </div>;
}
