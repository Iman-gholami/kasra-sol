import { useId } from 'react';
import { Phone } from 'lucide-react';
import { PHONE_LINES, SOCIAL_LINKS, type SocialLink } from '@/data/contact';
import { displayPhone, telHref } from '@/lib/phone';

/** Instagram's own mark: the white camera on its yellow-orange-magenta-violet tile. Each copy gets its own gradient id
 * (the contact page renders the icons twice: in the page and in the footer it hides there). */
export function InstagramLogo({ size = 24 }: { size?: number }) {
  const id = useId();
  return <svg className="brand-logo" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={id} cx="30%" cy="107%" r="150%">
        <stop offset="0" stopColor="#FDF497"/>
        <stop offset="0.05" stopColor="#FDF497"/>
        <stop offset="0.45" stopColor="#FD5949"/>
        <stop offset="0.6" stopColor="#D6249F"/>
        <stop offset="0.9" stopColor="#285AEB"/>
      </radialGradient>
    </defs>
    <rect width="24" height="24" rx="6.5" fill={'url(#' + id + ')'}/>
    <g fill="none" stroke="#FFFFFF" strokeWidth="1.8">
      <rect x="5" y="5" width="14" height="14" rx="4.2"/>
      <circle cx="12" cy="12" r="3.3"/>
    </g>
    <circle cx="16.1" cy="7.9" r="1.05" fill="#FFFFFF"/>
  </svg>;
}

/** Bale's own mark: a round speech bubble whose tail points up at the top left, holding a white tick («بله» is
 * "yes"), shaded from indigo at the bottom left to mint at the top right. Drawn from the logo on a 100-unit grid. */
export function BaleLogo({ size = 24 }: { size?: number }) {
  const id = useId();
  return <svg className="brand-logo" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#2E2F72"/>
        <stop offset="0.25" stopColor="#323F7A"/>
        <stop offset="0.5" stopColor="#3D8C94"/>
        <stop offset="0.78" stopColor="#48D3AB"/>
        <stop offset="1" stopColor="#4FE6B4"/>
      </linearGradient>
    </defs>
    <path d="M0 50V7C0 1 4 .5 8 2.6L21 9.2A50 50 0 1 1 0 50Z" fill={'url(#' + id + ')'}/>
    <path d="M26 49 42.5 65 74 34" fill="none" stroke="#FFFFFF" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

const SOCIAL_LOGOS: Record<SocialLink['id'], typeof BaleLogo> = { instagram: InstagramLogo, bale: BaleLogo };

/** One tap calls: the line's name, then its number in Persian digits, read left to right in groups. */
export function PhoneLines() {
  return <ul className="phone-lines">
    {PHONE_LINES.map(line => <li key={line.id}>
      <a className="phone-line" href={telHref(line.number)} data-line={line.id}>
        <span className="phone-line-label"><span className="sr-only">تماس با </span>{line.label}</span>
        <span className="phone-line-number" dir="ltr">{displayPhone(line.number)}</span>
        <span className="phone-line-call" aria-hidden="true"><Phone size={16} strokeWidth={2}/></span>
      </a>
    </li>)}
  </ul>;
}

/** The store's pages elsewhere; they open in a new tab so the shop stays where it was. */
export function SocialLinks() {
  return <ul className="social-links" aria-label="کسری در شبکه‌های اجتماعی">
    {SOCIAL_LINKS.map(link => {
      const Logo = SOCIAL_LOGOS[link.id];
      return <li key={link.id}>
        <a className="social-link" href={link.href} target="_blank" rel="noopener noreferrer" data-social={link.id}
          aria-label={link.label + ' کسری بوتیک (در پنجره تازه)'}>
          <Logo size={24}/>
          <span>{link.label}</span>
        </a>
      </li>;
    })}
  </ul>;
}
