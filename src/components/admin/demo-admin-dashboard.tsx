'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Activity, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, Eye, EyeOff,
  GalleryHorizontal, LayoutDashboard, LockKeyhole, LogOut, Package, ScrollText, Search,
  ShieldCheck, ShoppingBag, UserCog, UsersRound
} from 'lucide-react';
import { products } from '@/data/products';
import { formatNumber, formatToman } from '@/components/admin/labels';

type Tab = 'overview' | 'traffic' | 'products' | 'home' | 'orders' | 'staff' | 'audit' | 'account';
const SECTIONS = [
  { id: 'overview', title: 'داشبورد فروشگاه', name: 'داشبورد', icon: LayoutDashboard },
  { id: 'traffic', title: 'آمار بازدید', name: 'آمار بازدید', icon: Activity },
  { id: 'products', title: 'محصولات و موجودی', name: 'محصولات و موجودی', icon: Package },
  { id: 'home', title: 'اسلایدر صفحه اول', name: 'اسلایدر صفحه اول', icon: GalleryHorizontal },
  { id: 'orders', title: 'مدیریت سفارش‌ها', name: 'سفارش‌ها', icon: ClipboardList },
  { id: 'staff', title: 'کارکنان و مجوزها', name: 'کارکنان و مجوزها', icon: UsersRound },
  { id: 'audit', title: 'تاریخچه فعالیت‌ها', name: 'تاریخچه فعالیت‌ها', icon: ScrollText },
  { id: 'account', title: 'حساب نمایشی', name: 'حساب من', icon: UserCog }
] as const;

const ORDERS = [
  { id: 'KS-1048', date: '۱۴۰۵/۰۸/۰۱', items: 2, total: 1528000, status: 'در انتظار ارسال', tone: 'warning' },
  { id: 'KS-1047', date: '۱۴۰۵/۰۷/۳۰', items: 1, total: 1169000, status: 'ارسال‌شده', tone: 'info' },
  { id: 'KS-1046', date: '۱۴۰۵/۰۷/۲۹', items: 3, total: 2275000, status: 'تحویل‌شده', tone: 'success' },
  { id: 'KS-1045', date: '۱۴۰۵/۰۷/۲۸', items: 1, total: 589000, status: 'در انتظار بررسی', tone: 'warning' },
  { id: 'KS-1044', date: '۱۴۰۵/۰۷/۲۷', items: 2, total: 1860000, status: 'تحویل‌شده', tone: 'success' }
] as const;

const MONTH = [9, 13, 11, 18, 14, 21, 17, 24, 19, 27, 23, 31];
const SHOW_PRODUCTS = products.slice(0, 18);
const initialSlides = products.filter(item => item.compareAt && item.compareAt > item.price).slice(0, 3).map(item => item.id);

export function DemoAdminDashboard() {
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [slides, setSlides] = useState<string[]>(initialSlides);
  const [notice, setNotice] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');

  const matched = useMemo(() => SHOW_PRODUCTS.filter(item => {
    const matchesText = item.name.includes(query.trim()) || item.id.includes(query.trim().toLowerCase());
    const matchesStatus = status === 'all' || (status === 'low' && item.variants.reduce((n,v) => n + v.stock, 0) < 70) ||
      (status === 'sale' && !!item.compareAt && item.compareAt > item.price);
    return matchesText && matchesStatus;
  }), [query, status]);

  const activeSection = SECTIONS.find(item => item.id === tab)!;
  const selectedSlides = slides.map(id => products.find(item => item.id === id)).filter((item): item is (typeof products)[number] => !!item);

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (username.trim().toLowerCase() === 'demo' && password === 'kasra2026') {
      setSignedIn(true);
      setPassword('');
      setLoginError('');
    } else {
      setLoginError('اطلاعات نمایشی درست نیست. نام کاربری demo و رمز kasra2026 است.');
    }
  }

  function changeTab(next: Tab) {
    setTab(next);
    setNotice('');
  }

  function moveSlide(i: number, delta: number) {
    if (i + delta < 0 || i + delta >= slides.length) return;
    setSlides(current => {
      const next = [...current];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });
    setNotice('ترتیب اسلایدر فقط در همین نمایش تغییر کرده است.');
  }

  if (!signedIn) return <section className="admin-login admin-demo-login">
    <div className="admin-login-card">
      <div className="admin-login-mark" aria-hidden="true">K</div>
      <h1>ورود به پنل مدیریت نمایشی</h1>
      <p className="admin-login-desc">پیش‌نمایش کسری بوتیک · فقط اطلاعات نمونه</p>
      <div className="admin-demo-credentials" role="note">
        <strong>دسترسی مخصوص بازدیدکننده</strong>
        <span>نام کاربری: <code>demo</code></span>
        <span>رمز عبور: <code>kasra2026</code></span>
      </div>
      <form className="admin-login-form" onSubmit={login}>
        <label>نام کاربری
          <input autoComplete="off" dir="ltr" value={username} onChange={event => setUsername(event.target.value)}
            required maxLength={64} placeholder="demo"/>
        </label>
        <div className="admin-login-field">
          <label htmlFor="demo-password">رمز عبور</label>
          <span className="admin-password">
            <input id="demo-password" type={passwordVisible ? 'text' : 'password'} autoComplete="off"
              dir="ltr" required value={password} onChange={event => setPassword(event.target.value)}/>
            <button type="button" className="admin-password-toggle" onClick={() => setPasswordVisible(value => !value)}
              aria-label={passwordVisible ? 'پنهان کردن رمز' : 'نمایش رمز'} aria-pressed={passwordVisible}>
              {passwordVisible ? <EyeOff size={18}/> : <Eye size={18}/>}
            </button>
          </span>
        </div>
        {loginError && <p className="admin-login-error" role="alert">{loginError}</p>}
        <button className="admin-btn admin-btn-primary" type="submit">
          <LockKeyhole size={17}/> مشاهده پنل مدیریت
        </button>
      </form>
      <p className="admin-demo-footnote">این ورود فقط بخشی از رابط نمایشی است و جایگزین احراز هویت واقعی نیست.</p>
      <div className="admin-login-foot"><Link href="/"><ArrowLeft size={15}/> بازگشت به فروشگاه</Link></div>
    </div>
  </section>;

  return <div className="admin-app admin-demo-app" data-testid="admin-demo-app">
    <a className="skip-link" href="#demo-admin-content">رفتن به محتوای اصلی</a>
    <aside className="admin-sidebar" aria-label="منوی پنل نمایشی">
      <div className="admin-brand">
        <span className="admin-brand-mark" aria-hidden="true">K</span>
        <div><p className="admin-brand-title">کسری بوتیک</p><p className="admin-brand-subtitle">پنل مدیریت · دمو</p></div>
      </div>
      <p className="admin-nav-head">منوی اصلی</p>
      <nav className="admin-navigation" aria-label="بخش‌های مدیریت">
        {SECTIONS.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined}
          onClick={() => changeTab(item.id)}><item.icon size={19} aria-hidden="true"/>{item.name}</button>)}
      </nav>
      <div className="admin-side-spacer"/>
      <div className="admin-side-note">
        <strong>محیط نمایش امکانات</strong>
        <span>آمار، سفارش‌ها و کاربران این صفحه ساختگی‌اند. هیچ تغییری در سرور ذخیره نمی‌شود.</span>
        <Link href="/" target="_blank" rel="noopener noreferrer">مشاهده ویترین <ArrowLeft size={13}/></Link>
      </div>
      <button type="button" className="admin-signout" onClick={() => { setSignedIn(false); setPassword(''); }}>
        <LogOut size={18}/> خروج از نسخه نمایشی
      </button>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar">
        <div><h1 className="admin-page-title">{activeSection.title}</h1>
          <p className="admin-page-subtitle">کسری بوتیک / پیش‌نمایش پنل مدیریت</p></div>
        <div className="admin-account"><div><span className="admin-account-name">بازدیدکننده دمو</span>
          <span className="admin-account-role">فقط نمایش</span></div>
          <div className="admin-avatar" aria-hidden="true">د</div></div>
      </header>
      <div className="admin-main admin-demo-main" id="demo-admin-content">
        <p className="admin-demo-banner"><ShieldCheck size={19} aria-hidden="true"/>
          محیط دمو — داده‌ها فرضی هستند؛ ثبت سفارش، تغییر موجودی و عملیات واقعی غیرفعال است.</p>
        {notice && <div role="status" className="admin-notice" data-tone="info">{notice}</div>}

        {tab === 'overview' && <div className="admin-stack">
          <div className="admin-toolbar"><div><h2 className="admin-toolbar-heading">نمای کلی فروشگاه</h2>
            <p className="admin-toolbar-desc">گزارش نمونه برای ارزیابی پنل · اعداد واقعی نیستند</p></div></div>
          <div className="admin-demo-metrics">
            {[
              { title: 'سفارش‌های امروز', value: '۱۲', detail: '۳ سفارش نیازمند رسیدگی', icon: ShoppingBag },
              { title: 'فروش ماه نمونه', value: '۴۸٫۶ میلیون', detail: 'تومان · داده ساختگی', icon: LayoutDashboard },
              { title: 'محصولات منتشرشده', value: '۳۶', detail: '۳ کالکشن', icon: Package },
              { title: 'بازدید امروز', value: '۸۴۲', detail: 'آمار نمایشی', icon: Activity }
            ].map(item => <article key={item.title} className="admin-metric">
              <div className="admin-metric-head"><h3>{item.title}</h3><item.icon size={19}/></div>
              <p className="admin-metric-value">{item.value}</p><p className="admin-metric-hint">{item.detail}</p>
            </article>)}
          </div>
          <div className="admin-demo-panels">
            <section className="admin-panel"><div className="admin-panel-head"><h2>روند سفارش‌ها (نمونه)</h2></div>
              <div className="admin-panel-body">
                <div className="admin-demo-bars" aria-label="نمودار نمایشی فروش">
                  {MONTH.map((n,i) => <div key={i} title={formatNumber(n) + ' سفارش'} className="admin-demo-bar">
                    <span style={{ height: (n / 35 * 100) + '%' }}/><small>{formatNumber(i + 1)}</small>
                  </div>)}
                </div>
              </div></section>
            <section className="admin-panel"><div className="admin-panel-head"><h2>کارهای امروز</h2></div>
              <div className="admin-panel-body admin-stack-sm">
                <button className="admin-demo-task" type="button" onClick={() => changeTab('orders')}>
                  <ClipboardList size={18}/> بررسی سفارش‌های جدید <ArrowLeft size={16}/></button>
                <button className="admin-demo-task" type="button" onClick={() => changeTab('products')}>
                  <Package size={18}/> مشاهده موجودی محصولات <ArrowLeft size={16}/></button>
                <button className="admin-demo-task" type="button" onClick={() => changeTab('home')}>
                  <GalleryHorizontal size={18}/> چیدمان اسلایدر صفحه اول <ArrowLeft size={16}/></button>
              </div></section>
          </div>
        </div>}

        {tab === 'traffic' && <div className="admin-stack">
          <div className="admin-demo-metrics">
            {[['بازدید امروز', '۸۴۲'], ['بازدیدکننده یکتا', '۵۲۸'], ['بازدید هفتگی', '۴٬۹۸۰'], ['نرخ تبدیل نمونه', '۲٫۴٪']]
              .map(([title,value]) => <article key={title} className="admin-metric">
                <div className="admin-metric-head"><h3>{title}</h3><Activity size={19}/></div>
                <p className="admin-metric-value">{value}</p><p className="admin-metric-hint">آمار فرضی</p>
              </article>)}
          </div>
          <section className="admin-panel"><div className="admin-panel-head"><h2>بازدید روزانه نمونه</h2></div>
            <div className="admin-panel-body"><div className="admin-demo-bars admin-demo-bars-long">
              {[41,65,53,84,63,92,72,60,88,75,96,82].map((n,i) =>
                <div key={i} className="admin-demo-bar"><span style={{height:n+'%'}}/><small>{formatNumber(i+1)}</small></div>)}
            </div></div></section>
          <section className="admin-panel"><div className="admin-panel-head"><h2>منابع بازدید (نمونه)</h2></div>
            <div className="admin-panel-body admin-stack-sm">{[
              ['ورود مستقیم',45], ['جست‌وجوی گوگل',30], ['شبکه‌های اجتماعی',18], ['سایر',7]
            ].map(([name,count]) => <div key={name} className="admin-demo-progress">
              <span>{name}</span><div><i style={{width:count+'%'}}/></div><strong>{formatNumber(Number(count))}٪</strong>
            </div>)}</div></section>
        </div>}

        {tab === 'products' && <div className="admin-stack">
          <div className="admin-toolbar"><div><h2 className="admin-toolbar-heading">فهرست محصولات</h2>
            <p className="admin-toolbar-desc">تصاویر و مشخصات از کاتالوگ نمایشی کسری</p></div>
            <button type="button" className="admin-btn admin-btn-outline" onClick={() => setNotice('در نسخه نمایشی، ایجاد و ویرایش واقعی محصول غیرفعال است.')}>
              + محصول جدید (دمو)</button></div>
          <section className="admin-panel"><div className="admin-panel-body">
            <div className="admin-demo-filters">
              <label className="admin-demo-search"><Search size={17} aria-hidden="true"/>
                <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="جست‌وجوی نام یا کد محصول" aria-label="جست‌وجوی محصول"/></label>
              <select value={status} onChange={event => setStatus(event.target.value)} aria-label="فیلتر محصولات">
                <option value="all">همه محصولات</option><option value="sale">تخفیف‌دار</option><option value="low">موجودی پایین (نمونه)</option>
              </select>
            </div>
            <p className="admin-sub">نمایش {formatNumber(matched.length)} محصول نمونه</p>
            <div className="admin-demo-product-list">{matched.map(item => <article className="admin-demo-product" key={item.id}>
              <Image src={item.images[0]} alt="" width={64} height={76}/>
              <div><strong>{item.name}</strong><span className="admin-sub">{item.id} · {item.category === 'manto' ? 'مانتو' : item.category === 'shomiz' ? 'شومیز' : 'تیشرت'}</span></div>
              <span className="admin-demo-price">{formatToman(item.price)}</span>
              <span className="admin-badge" data-tone="success">منتشرشده</span>
            </article>)}</div>
            {matched.length === 0 && <p className="admin-empty">محصولی با این فیلتر پیدا نشد.</p>}
          </div></section>
        </div>}

        {tab === 'home' && <div className="admin-stack admin-narrow">
          <section className="admin-panel"><div className="admin-panel-head"><div><h2>اسلایدر صفحه اول</h2>
            <p>چیدمان آزمایشی محصولات · حداکثر پنج اسلاید</p></div></div>
            <div className="admin-panel-body admin-stack-sm">
              {selectedSlides.map((item,i) => <div className="admin-demo-product" key={item.id}>
                <Image src={item.images[0]} alt="" width={64} height={76}/>
                <div><strong>{item.name}</strong><span className="admin-sub">اسلاید {formatNumber(i+1)}</span></div>
                <span className="admin-demo-slide-actions">
                  <button type="button" className="admin-icon-btn" disabled={i === 0} onClick={() => moveSlide(i,-1)} aria-label="جابه‌جایی به بالا"><ChevronUp size={17}/></button>
                  <button type="button" className="admin-icon-btn" disabled={i === slides.length - 1} onClick={() => moveSlide(i,1)} aria-label="جابه‌جایی به پایین"><ChevronDown size={17}/></button>
                  <button type="button" className="admin-btn admin-btn-outline admin-btn-small"
                    onClick={() => {setSlides(current => current.filter(id => id !== item.id));setNotice('محصول فقط از اسلایدر نمایشی حذف شد.');}}>حذف</button>
                </span>
              </div>)}
              <div className="admin-actions"><button type="button" className="admin-btn admin-btn-primary"
                onClick={() => setNotice('چیدمان در همین صفحه نمایش داده می‌شود؛ در دیتابیس یا ویترین واقعی ذخیره نشده است.')}>
                <CheckCircle2 size={17}/> ذخیره نمایشی</button>
                <button type="button" className="admin-btn admin-btn-outline" onClick={() => {setSlides(initialSlides);setNotice('چیدمان نمونه بازنشانی شد.');}}>بازنشانی</button></div>
            </div></section>
          <section className="admin-panel"><div className="admin-panel-head"><h2>افزودن محصول نمونه</h2></div>
            <div className="admin-panel-body admin-stack-sm">
              {products.slice(3,9).map(item => <div className="admin-demo-product" key={item.id}>
                <Image src={item.images[0]} alt="" width={58} height={68}/>
                <div><strong>{item.name}</strong><span className="admin-sub">{formatToman(item.price)}</span></div>
                <button type="button" className="admin-btn admin-btn-outline admin-btn-small"
                  disabled={slides.includes(item.id) || slides.length >= 5}
                  onClick={() => {setSlides(current => [...current,item.id]);setNotice('محصول به چیدمان نمایشی اضافه شد.');}}>افزودن</button>
              </div>)}
            </div></section>
        </div>}

        {tab === 'orders' && <div className="admin-stack">
          <div className="admin-toolbar"><div><h2 className="admin-toolbar-heading">سفارش‌های نمونه</h2>
            <p className="admin-toolbar-desc">بدون اطلاعات مشتری واقعی یا پرداخت فعال</p></div>
            <select className="admin-demo-select" value={orderFilter} onChange={event=>setOrderFilter(event.target.value)} aria-label="فیلتر سفارش‌ها">
              <option value="all">همه سفارش‌ها</option><option value="open">در انتظار رسیدگی</option><option value="done">ارسال یا تحویل‌شده</option>
            </select>
          </div>
          <section className="admin-panel"><div className="admin-panel-body">
            <div className="admin-demo-order-list">
              {ORDERS.filter(order => orderFilter === 'all' || (orderFilter === 'open' ? order.status.includes('انتظار') : !order.status.includes('انتظار')))
                .map(order => <article key={order.id} className="admin-demo-order">
                  <div><strong>{order.id}</strong><span className="admin-sub">{order.date} · {formatNumber(order.items)} قلم</span></div>
                  <span>{formatToman(order.total)}</span>
                  <span className="admin-badge" data-tone={order.tone}>{order.status}</span>
                  <button type="button" className="admin-btn admin-btn-outline admin-btn-small"
                    onClick={() => setNotice('جزئیات این سفارش ساختگی است؛ هیچ رسیدگی واقعی انجام نمی‌شود.')}>جزئیات نمایشی</button>
                </article>)}
            </div>
          </div></section>
        </div>}

        {tab === 'staff' && <section className="admin-panel"><div className="admin-panel-head"><h2>کارکنان و مجوزها (نمونه)</h2></div>
          <div className="admin-panel-body admin-stack-sm">{[
            ['صاحب فروشگاه (نمونه)','مالک','success'], ['مدیر سفارش‌ها (نمونه)','مدیر','info'],
            ['مسئول انبار (نمونه)','کارمند','neutral']
          ].map(([name,role,tone]) => <div className="admin-demo-product" key={name}>
            <span className="admin-demo-avatar"><UsersRound size={20}/></span>
            <div><strong>{name}</strong><span className="admin-sub">حساب ساختگی</span></div>
            <span className="admin-badge" data-tone={tone}>{role}</span>
          </div>)}
            <p className="admin-sub">افزودن کاربر و تنظیم دسترسی‌ها در نسخه نمایشی غیرفعال است.</p>
          </div></section>}

        {tab === 'audit' && <section className="admin-panel"><div className="admin-panel-head"><h2>تاریخچه فعالیت‌ها (نمونه)</h2></div>
          <div className="admin-panel-body admin-stack-sm">{[
            ['۱۰:۴۰','تغییر ترتیب اسلایدر صفحه اول','صاحب فروشگاه (نمونه)'],
            ['۰۹:۲۲','ویرایش موجودی محصول','مسئول انبار (نمونه)'],
            ['دیروز','به‌روزرسانی وضعیت سفارش','مدیر سفارش‌ها (نمونه)']
          ].map(([when,what,who]) => <div className="admin-demo-audit" key={what}>
            <span>{when}</span><strong>{what}</strong><small>{who}</small></div>)}
          </div></section>}

        {tab === 'account' && <section className="admin-panel admin-narrow"><div className="admin-panel-head"><h2>حساب بازدیدکننده دمو</h2></div>
          <div className="admin-panel-body admin-stack-sm">
            <p><strong>نام کاربری:</strong> demo</p><p><strong>نقش:</strong> مشاهده‌کننده نمایشی</p>
            <p>ورود در این صفحه نمونه‌ای از ظاهر پنل است؛ احراز هویت واقعی، مدیریت کاربران و تغییر رمز به بک‌اند عملیاتی نیاز دارند.</p>
            <button className="admin-btn admin-btn-outline admin-self-start" onClick={() => setSignedIn(false)} type="button">خروج از دمو</button>
          </div></section>}
      </div>
    </div>
  </div>;
}
