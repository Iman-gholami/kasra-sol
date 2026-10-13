import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'راهنمای سایز' };
export default function Page() { return <article className="container content-page"><span className="eyebrow">FIND YOUR FIT</span><h1>راهنمای سایز</h1>
  <p>برای انتخاب دقیق‌تر، با متر نرم دور سینه، دور کمر و دور باسن را بدون کشیدن متر اندازه بگیر. جدول زیر صرفاً مرجع عمومی نمونه است و جایگزین اندازه‌گیری واقعی محصولات نمی‌شود.</p>
  <div style={{overflowX:'auto'}}><table><thead><tr><th>سایز</th><th>دور سینه (سانتی‌متر)</th><th>دور کمر (سانتی‌متر)</th><th>دور باسن (سانتی‌متر)</th></tr></thead>
    <tbody><tr><td>S</td><td>۸۴–۸۸</td><td>۶۶–۷۰</td><td>۹۰–۹۴</td></tr><tr><td>M</td><td>۸۸–۹۴</td><td>۷۰–۷۶</td><td>۹۴–۱۰۰</td></tr>
    <tr><td>L</td><td>۹۴–۱۰۰</td><td>۷۶–۸۲</td><td>۱۰۰–۱۰۶</td></tr><tr><td>XL</td><td>۱۰۰–۱۰۸</td><td>۸۲–۹۰</td><td>۱۰۶–۱۱۴</td></tr></tbody></table></div>
  <div className="demo-alert" style={{marginTop:24}}>این اعداد استاندارد رسمی برند نیستند و باید با الگوی هر محصول تطبیق داده شوند.</div>
</article>; }
