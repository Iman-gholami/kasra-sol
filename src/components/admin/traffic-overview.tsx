'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowDownLeft, ArrowUpLeft, Eye, MonitorSmartphone, RefreshCw, ShieldCheck, ShoppingBag, Table2, Users } from 'lucide-react';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { formatNumber } from '@/components/admin/labels';
import { Loading, Notice } from '@/components/admin/ui';

type Day = { date: string; views: number; visitors: number; orders: number };
type Traffic = {
  days: number; today: Day; yesterday: Day | null; live: number;
  totals: { views: number; visitors: number; orders: number; conversion: number };
  daily: Day[]; hours: { hour: number; views: number }[];
  pages: { path: string; views: number; visitors: number }[];
  products: { slug: string; id: string | null; name: string | null; views: number; visitors: number; units: number }[];
  sources: { source: 'direct' | 'search' | 'social' | 'compare' | 'other'; views: number }[];
  referrers: { host: string; source: string; views: number }[];
  devices: { device: 'mobile' | 'desktop' | 'tablet'; views: number; visitors: number }[];
};
const RANGES = [7, 30, 90] as const;
const SOURCE_LABEL = { direct: 'ورود مستقیم', search: 'موتور جست‌وجو', social: 'شبکه‌های اجتماعی', compare: 'سایت مقایسه قیمت', other: 'سایر سایت‌ها' };
const DEVICE_LABEL = { mobile: 'موبایل', desktop: 'دسکتاپ', tablet: 'تبلت' };
const percent = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 1 });
const dayShort = new Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const dayLong = new Intl.DateTimeFormat('fa-IR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const asDate = (date: string) => new Date(date + 'T12:00:00Z');
const share = (part: number, whole: number) => whole ? part / whole : 0;

function pageLabel(path: string) {
  if (path === '/') return 'صفحه اصلی';
  const named: Record<string, string> = { '/shop': 'همه محصولات', '/cart': 'سبد خرید', '/checkout': 'تسویه حساب',
    '/search': 'جست‌وجو', '/wishlist': 'علاقه‌مندی‌ها', '/order-confirmation': 'تأیید سفارش', '/category/manto': 'دسته مانتو',
    '/category/shomiz': 'دسته شومیز', '/category/tshirt': 'دسته تیشرت' };
  return named[path] ?? (path.startsWith('/product/') ? 'صفحه محصول' : 'صفحه');
}
const readablePath = (path: string) => { try { return decodeURI(path); } catch { return path; } };
/** Round axis maximum and 3-4 ticks (0 / 5 / 10 / 15 …). */
function ticks(max: number) {
  if (max <= 0) return [0, 1];
  const raw = max / 3;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(n => n * power).find(n => n >= raw)!;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}
/** The element's width, measured before the first paint so a chart is never drawn wider than a phone screen. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(Math.round(ref.current.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined) return null;
  if (before === 0) return now ? <span className="tr-delta" data-dir="up"><ArrowUpLeft size={14} aria-hidden="true"/>دیروز صفر بود</span> : null;
  const change = (now - before) / before;
  if (Math.abs(change) < 0.005) return <span className="tr-delta">بدون تغییر نسبت به دیروز</span>;
  const up = change > 0;
  return <span className="tr-delta" data-dir={up ? 'up' : 'down'}>
    {up ? <ArrowUpLeft size={14} aria-hidden="true"/> : <ArrowDownLeft size={14} aria-hidden="true"/>}
    {(up ? '+' : '−') + percent.format(Math.abs(change))} نسبت به دیروز
  </span>;
}
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values), w = 96, h = 28, inset = 5;
  const points = values.map((value, i) => [w - inset - i / (values.length - 1) * (w - 2 * inset), h - inset - value / max * (h - 2 * inset)]);
  const [x, y] = points.at(-1)!;
  return <svg className="tr-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
    <polyline points={points.map(p => p.join(',')).join(' ')} fill="none"/>
    <circle cx={x} cy={y} r={3.5}/>
  </svg>;
}
function Tile({ label, value, icon: Icon, children, testId }: {
  label: string; value: string; icon: typeof Eye; children?: React.ReactNode; testId: string;
}) {
  return <article className="tr-tile" data-testid={testId}>
    <div className="tr-tile-head"><h3>{label}</h3><span aria-hidden="true"><Icon size={18}/></span></div>
    <p className="tr-tile-value">{value}</p>
    <div className="tr-tile-foot">{children}</div>
  </article>;
}

/** Daily views (area + line) and daily visitors (line), one count axis. Time runs right to left like the text,
 * so the value axis sits on the right (where time starts) and today's end labels on the left. */
function DailyChart({ daily }: { daily: Day[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const height = 240, pad = { top: 16, right: 44, bottom: 30, left: 44 };
  const plotW = Math.max(120, width - pad.left - pad.right), plotH = height - pad.top - pad.bottom;
  const axis = ticks(Math.max(...daily.map(d => d.views)));
  const top = axis.at(-1)!;
  const x = (i: number) => pad.left + plotW - (daily.length === 1 ? plotW / 2 : i / (daily.length - 1) * plotW);
  const y = (v: number) => pad.top + plotH - v / top * plotH;
  const line = (key: 'views' | 'visitors') => daily.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[key]).toFixed(1)).join(' ');
  const area = line('views') + ` L${x(daily.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  // Date labels counted back from today, spaced at least 60px apart so they never run together on a phone.
  const every = [1, 2, 3, 5, 7, 10, 15, 30].find(n => n * plotW / Math.max(1, daily.length - 1) >= 60) ?? 30;
  const last = daily.length - 1;
  const labelsApart = Math.abs(y(daily[last].views) - y(daily[last].visitors)) > 16;
  function pick(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const fromRight = box.right - pad.right - event.clientX;
    setActive(Math.max(0, Math.min(last, Math.round(fromRight / plotW * last))));
  }
  function keys(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: 1, ArrowRight: -1, Home: -Infinity, End: Infinity }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    setActive(current => Math.max(0, Math.min(last, (current ?? last) + step)));
  }
  const point = active === null ? null : daily[active];
  return <div className="tr-chart" ref={ref} tabIndex={0} role="group" onKeyDown={keys}
    aria-label="نمودار بازدید روزانه؛ با کلیدهای جهت روزها را مرور کنید"
    onPointerMove={pick} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)}>
    {width > 0 && <svg width={width} height={height} aria-hidden="true" direction="ltr">
      {axis.map(tick => <g key={tick}>
        <line className="tr-grid" x1={pad.left} x2={pad.left + plotW} y1={y(tick)} y2={y(tick)}/>
        <text className="tr-axis" x={pad.left + plotW + 8} y={y(tick) + 4} textAnchor="start">{formatNumber(tick)}</text>
      </g>)}
      {daily.map((d, i) => (last - i) % every === 0 && <text key={d.date} className="tr-axis" x={x(i)} y={height - 8}
        textAnchor="middle" direction="rtl">{dayShort.format(asDate(d.date))}</text>)}
      <path className="tr-area" d={area}/>
      <path className="tr-line tr-s1" d={line('views')}/>
      <path className="tr-line tr-s2" d={line('visitors')}/>
      {point && <line className="tr-crosshair" x1={x(active!)} x2={x(active!)} y1={pad.top} y2={pad.top + plotH}/>}
      {(point ? [active!] : [last]).map(i => <g key={i}>
        <circle className="tr-dot tr-s1" cx={x(i)} cy={y(daily[i].views)} r={4.5}/>
        <circle className="tr-dot tr-s2" cx={x(i)} cy={y(daily[i].visitors)} r={4.5}/>
      </g>)}
      {!point && labelsApart && <>
        <text className="tr-end" x={x(last) - 8} y={y(daily[last].views) + 4} textAnchor="end">{formatNumber(daily[last].views)}</text>
        <text className="tr-end" x={x(last) - 8} y={y(daily[last].visitors) + 4} textAnchor="end">{formatNumber(daily[last].visitors)}</text>
      </>}
    </svg>}
    {point && <div className="tr-tooltip" role="status" style={x(active!) > width / 2
      ? { right: width - x(active!) + 12 } : { left: x(active!) + 12 }}>
      <strong>{dayLong.format(asDate(point.date))}</strong>
      <span><i className="tr-key tr-s1" aria-hidden="true"/><b>{formatNumber(point.views)}</b> بازدید صفحه</span>
      <span><i className="tr-key tr-s2" aria-hidden="true"/><b>{formatNumber(point.visitors)}</b> بازدیدکننده</span>
      <span><b>{formatNumber(point.orders)}</b> سفارش</span>
    </div>}
  </div>;
}

function HoursChart({ hours }: { hours: Traffic['hours'] }) {
  const max = Math.max(1, ...hours.map(h => h.views));
  const peak = hours.reduce((best, h) => h.views > best.views ? h : best, hours[0]);
  return <>
  <p className="tr-muted">{peak.views ? 'شلوغ‌ترین ساعت: ' + formatNumber(peak.hour) + ' تا ' + formatNumber((peak.hour + 1) % 24) +
    ' با ' + formatNumber(peak.views) + ' بازدید (به وقت تهران)' : 'هنوز بازدیدی ثبت نشده است.'}</p>
  <div className="tr-hours" role="list" aria-label="بازدید بر اساس ساعت روز">
    {hours.map(h => <div role="listitem" key={h.hour} className="tr-hour" data-peak={h.views > 0 && h.hour === peak.hour || undefined}
      aria-label={'ساعت ' + formatNumber(h.hour) + ': ' + formatNumber(h.views) + ' بازدید'}
      title={'ساعت ' + formatNumber(h.hour) + ' تا ' + formatNumber((h.hour + 1) % 24) + ' — ' + formatNumber(h.views) + ' بازدید'}>
      <span className="tr-hour-track"><span className="tr-hour-bar" style={{ height: h.views ? Math.max(4, h.views / max * 100) + '%' : 0 }}/></span>
      <span className="tr-hour-label" aria-hidden="true">{h.hour % 3 === 0 ? formatNumber(h.hour) : ''}</span>
    </div>)}
  </div>
  </>;
}

function Stacked<K extends string>({ parts, labels, title }: {
  parts: { key: K; value: number }[]; labels: Record<K, string>; title: string;
}) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const shown = parts.filter(part => part.value > 0);
  return <div>
    <div className="tr-stack" role="img" aria-label={title + ': ' + shown.map(p => labels[p.key] + ' ' + percent.format(share(p.value, total))).join('، ')}>
      {shown.map(part => <span key={part.key} data-key={part.key} style={{ flexGrow: part.value }}/>)}
    </div>
    <ul className="tr-legend">
      {parts.map(part => <li key={part.key}><i data-key={part.key} aria-hidden="true"/>
        <span>{labels[part.key]}</span><b>{percent.format(share(part.value, total))}</b>
        <small>{formatNumber(part.value)}</small></li>)}
    </ul>
  </div>;
}

function Ranked({ rows, empty }: { rows: { key: string; title: string; sub: string; value: number; extra?: string }[]; empty: string }) {
  if (!rows.length) return <p className="admin-empty-inline">{empty}</p>;
  const max = Math.max(...rows.map(r => r.value));
  return <ol className="tr-ranked">
    {rows.map(row => <li key={row.key}>
      <div className="tr-ranked-text"><strong>{row.title}</strong><bdi dir="ltr">{row.sub}</bdi></div>
      <div className="tr-ranked-bar" aria-hidden="true"><span style={{ width: Math.max(2, row.value / max * 100) + '%' }}/></div>
      <div className="tr-ranked-value"><b>{formatNumber(row.value)}</b>{row.extra && <small>{row.extra}</small>}</div>
    </li>)}
  </ol>;
}

export function TrafficOverview() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const [data, setData] = useState<Traffic | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [table, setTable] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    adminApi<Traffic>('reports/traffic?days=' + days, { signal: abort.signal })
      .then(result => { setData(result); setError(''); })
      .catch(cause => { if (!abort.signal.aborted) setError(errorMessage(cause)); })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => abort.abort();
  }, [days, version]);
  const spark = useMemo(() => (data?.daily ?? []).slice(-14), [data]);

  return <div className="admin-stack admin-traffic" data-testid="traffic-overview">
    <div className="admin-toolbar">
      <div>
        <h2 className="admin-toolbar-heading">آمار بازدید فروشگاه</h2>
        <p className="admin-toolbar-desc">بازدید واقعی ویترین، بدون کوکی و بدون ثبت IP · روزها به وقت تهران</p>
      </div>
      <div className="admin-actions">
        <div className="tr-range" role="group" aria-label="بازه گزارش">
          {RANGES.map(range => <button type="button" key={range} aria-pressed={days === range}
            onClick={() => { if (range !== days) { setBusy(true); setDays(range); } }}>{formatNumber(range)} روز</button>)}
        </div>
        <button type="button" className="admin-btn admin-btn-outline" disabled={busy}
          onClick={() => { setBusy(true); setVersion(v => v + 1); }}><RefreshCw size={15} aria-hidden="true"/> به‌روزرسانی</button>
      </div>
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    {!data ? (!error && <Loading label="در حال دریافت آمار بازدید…"/>) : <div className="admin-stack" aria-busy={busy} data-busy={busy || undefined}>
      <div className="tr-tiles">
        <Tile testId="traffic-today-views" label="بازدید امروز" icon={Eye} value={formatNumber(data.today.views)}>
          <Delta now={data.today.views} before={data.yesterday?.views}/>
          <Sparkline values={spark.map(d => d.views)}/>
        </Tile>
        <Tile testId="traffic-today-visitors" label="بازدیدکننده امروز" icon={Users} value={formatNumber(data.today.visitors)}>
          <Delta now={data.today.visitors} before={data.yesterday?.visitors}/>
          <Sparkline values={spark.map(d => d.visitors)}/>
        </Tile>
        <Tile testId="traffic-live" label="آنلاین همین حالا" icon={MonitorSmartphone} value={formatNumber(data.live)}>
          <span className="tr-live"><i aria-hidden="true"/>بازدیدکننده در ۵ دقیقه اخیر</span>
        </Tile>
        <Tile testId="traffic-conversion" label={'نرخ تبدیل ' + formatNumber(data.days) + ' روز'} icon={ShoppingBag}
          value={percent.format(data.totals.conversion)}>
          <span className="tr-muted">{formatNumber(data.totals.orders)} سفارش از {formatNumber(data.totals.visitors)} بازدیدکننده روزانه</span>
        </Tile>
      </div>

      <section className="admin-panel" aria-labelledby="tr-daily-title">
        <div className="admin-panel-head">
          <div>
            <h3 id="tr-daily-title">بازدید روزانه، {formatNumber(data.days)} روز اخیر</h3>
            <p>{formatNumber(data.totals.views)} بازدید صفحه · {formatNumber(data.totals.visitors)} بازدیدکننده روزانه</p>
          </div>
          <div className="admin-actions">
            <ul className="tr-legend tr-legend-inline" aria-label="راهنمای نمودار">
              <li><i className="tr-key tr-s1" aria-hidden="true"/><span>بازدید صفحه</span></li>
              <li><i className="tr-key tr-s2" aria-hidden="true"/><span>بازدیدکننده</span></li>
            </ul>
            <button type="button" className="admin-btn admin-btn-outline admin-btn-small" aria-expanded={table}
              aria-controls="tr-daily-table" onClick={() => setTable(t => !t)}>
              <Table2 size={14} aria-hidden="true"/> {table ? 'پنهان کردن جدول' : 'نمایش جدول'}</button>
          </div>
        </div>
        <div className="admin-panel-body">
          {data.totals.views === 0 && <p className="admin-empty-inline">در این بازه هنوز بازدیدی ثبت نشده است. آمار از اولین بازدید واقعی ویترین پر می‌شود.</p>}
          <DailyChart daily={data.daily}/>
          {table && <div className="admin-table-scroll" id="tr-daily-table">
            <table className="admin-table admin-table-compact">
              <caption className="sr-only">بازدید، بازدیدکننده و سفارش هر روز</caption>
              <thead><tr><th scope="col">روز</th><th scope="col">بازدید صفحه</th><th scope="col">بازدیدکننده</th><th scope="col">سفارش</th></tr></thead>
              <tbody>{[...data.daily].reverse().map(day => <tr key={day.date}>
                <th scope="row">{dayLong.format(asDate(day.date))}</th><td>{formatNumber(day.views)}</td>
                <td>{formatNumber(day.visitors)}</td><td>{formatNumber(day.orders)}</td></tr>)}</tbody>
            </table>
          </div>}
        </div>
      </section>

      <div className="admin-two-col">
        <section className="admin-panel" aria-labelledby="tr-products-title">
          <div className="admin-panel-head"><div><h3 id="tr-products-title">محصولات پربازدید</h3>
            <p>بازدید صفحه محصول و تعداد سفارش‌داده‌شده در همین بازه</p></div></div>
          <div className="admin-panel-body">
            <Ranked empty="هنوز صفحه محصولی دیده نشده است." rows={data.products.map(p => ({
              key: p.slug, title: p.name ?? 'محصول حذف یا تغییرنام‌داده', sub: p.slug, value: p.views,
              extra: formatNumber(p.units) + ' عدد سفارش' + (p.visitors ? ' · ' + percent.format(share(p.units, p.visitors)) : '') }))}/>
          </div>
        </section>
        <section className="admin-panel" aria-labelledby="tr-pages-title">
          <div className="admin-panel-head"><div><h3 id="tr-pages-title">صفحه‌های پربازدید</h3>
            <p>بدون پارامترهای جست‌وجو و بدون صفحه‌های مدیریت</p></div></div>
          <div className="admin-panel-body">
            <Ranked empty="هنوز بازدیدی ثبت نشده است." rows={data.pages.map(p => ({
              key: p.path, title: pageLabel(p.path), sub: readablePath(p.path), value: p.views,
              extra: formatNumber(p.visitors) + ' بازدیدکننده' }))}/>
          </div>
        </section>
      </div>

      <div className="admin-two-col">
        <section className="admin-panel" aria-labelledby="tr-sources-title">
          <div className="admin-panel-head"><div><h3 id="tr-sources-title">بازدیدکننده‌ها از کجا می‌آیند؟</h3>
            <p>منبع ورود، بر اساس سایت ارجاع‌دهنده (فقط نام دامنه ذخیره می‌شود)</p></div></div>
          <div className="admin-panel-body admin-stack-sm">
            <Stacked title="سهم منابع ورود" labels={SOURCE_LABEL}
              parts={data.sources.map(s => ({ key: s.source, value: s.views }))}/>
            {data.referrers.length > 0 && <Ranked empty="" rows={data.referrers.map(r => ({
              key: r.host, title: r.host, sub: SOURCE_LABEL[r.source as keyof typeof SOURCE_LABEL] ?? '', value: r.views }))}/>}
          </div>
        </section>
        <section className="admin-panel" aria-labelledby="tr-devices-title">
          <div className="admin-panel-head"><div><h3 id="tr-devices-title">دستگاه و ساعت‌های شلوغ</h3>
            <p>نوع دستگاه بازدیدکننده‌ها و توزیع بازدید در ساعت‌های روز</p></div></div>
          <div className="admin-panel-body admin-stack">
            <Stacked title="سهم دستگاه‌ها" labels={DEVICE_LABEL}
              parts={data.devices.map(d => ({ key: d.device, value: d.views }))}/>
            <div>
              <h4 className="tr-subtitle">ساعت‌های اوج بازدید</h4>
              <HoursChart hours={data.hours}/>
            </div>
          </div>
        </section>
      </div>

      <p className="admin-footnote"><ShieldCheck size={16} aria-hidden="true"/>
        حریم خصوصی: کوکی، IP و نشانی کامل صفحه ذخیره نمی‌شود. هر بازدیدکننده فقط با یک شناسه یک‌طرفه شمرده می‌شود که
        هر روز عوض می‌شود؛ پس بازدیدکننده «روزانه» است و بین روزها دنبال نمی‌شود. ربات‌ها و صفحه‌های مدیریت شمرده نمی‌شوند.</p>
    </div>}
  </div>;
}
