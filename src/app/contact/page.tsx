import type { Metadata } from 'next';
import { pageMetadata, SITE_NAME } from '@/lib/seo';
import Link from 'next/link';
import { PhoneLines, SocialLinks } from '@/components/layout/contact-channels';
export const metadata: Metadata = { title: 'ارتباط با ما', ...pageMetadata({ path: '/contact', title: 'ارتباط با ما | ' + SITE_NAME }) };
export default function Page() {
  return <article className="container content-page contact-page">
    <p className="section-kicker">ارتباط با ما</p>
    <h1>حرفی با کسری داری؟</h1>
    <p className="content-lede">با همان بخشی تماس بگیر که کارت به آن مربوط است. روی گوشی، با لمس هر شماره تماس گرفته می‌شود.</p>
    <PhoneLines/>
    <h2>کسری در شبکه‌های اجتماعی</h2>
    <SocialLinks/>
    <p>جواب خیلی از سؤال‌ها هم در <Link className="link-inline" href="/faq">سؤال‌های پرتکرار</Link> و <Link className="link-inline" href="/size-guide">راهنمای سایز</Link> هست.</p>
  </article>;
}
