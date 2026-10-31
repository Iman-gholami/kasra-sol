import type { Metadata } from 'next';
import { pageMetadata, SITE_NAME } from '@/lib/seo';
import { Info } from 'lucide-react';
export const metadata: Metadata = { title: 'راهنمای سایز', ...pageMetadata({ path: '/size-guide', title: 'راهنمای سایز | ' + SITE_NAME }) };
const rows = [
  ['S', '۸۴–۸۸', '۶۶–۷۰', '۹۰–۹۴'], ['M', '۸۸–۹۴', '۷۰–۷۶', '۹۴–۱۰۰'],
  ['L', '۹۴–۱۰۰', '۷۶–۸۲', '۱۰۰–۱۰۶'], ['XL', '۱۰۰–۱۰۸', '۸۲–۹۰', '۱۰۶–۱۱۴']
];
export default function Page() {
  return <article className="container content-page">
    <p className="section-kicker">راهنمای سایز</p>
    <h1>سایز مناسبت را پیدا کن</h1>
    <p className="content-lede">با متر نرم دور سینه، دور کمر و دور باسن را بدون کشیدن متر اندازه بگیر. جدول زیر فقط مرجع عمومی نمونه است و جایگزین اندازه‌گیری واقعی هر محصول نمی‌شود.</p>
    <div className="table-scroll" role="region" aria-labelledby="size-table-caption" tabIndex={0}>
      <table className="size-table">
        <caption id="size-table-caption">اندازه‌های عمومی نمونه (سانتی‌متر)</caption>
        <thead><tr><th scope="col">سایز</th><th scope="col">دور سینه</th><th scope="col">دور کمر</th><th scope="col">دور باسن</th></tr></thead>
        <tbody>{rows.map(([size, ...cells]) => <tr key={size}><th scope="row"><span dir="ltr">{size}</span></th>{cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p className="notice"><Info size={18} aria-hidden="true"/><span>این اعداد استاندارد رسمی برند نیستند و باید با الگوی هر محصول تطبیق داده شوند.</span></p>
  </article>;
}
