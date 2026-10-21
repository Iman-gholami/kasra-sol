'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronUp, GalleryHorizontal, ImageIcon, Plus, Search, X } from 'lucide-react';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { formatNumber, formatToman, PRODUCT_STATUS } from '@/components/admin/labels';
import { Badge, Loading, Notice } from '@/components/admin/ui';
import type { ProductRow } from '@/components/admin/product-list';

type Slide = Pick<ProductRow, 'id' | 'name' | 'price' | 'compareAt' | 'images' | 'status'>;
type State = { tone: 'error' | 'success' | 'warning'; text: string } | null;

function Thumb({ slide }: { slide: Slide }) {
  return <span className="admin-product-image">
    {slide.images?.[0] ? <Image src={slide.images[0]} alt="" width={54} height={62} unoptimized/> : <ImageIcon size={22} aria-hidden="true"/>}
  </span>;
}
function Prices({ slide }: { slide: Slide }) {
  return <>
    <span className="admin-sub">{formatToman(slide.price)}</span>
    {slide.compareAt && slide.compareAt > slide.price ? <span className="admin-sub">قبل از تخفیف: {formatToman(slide.compareAt)}</span> : null}
  </>;
}

/** «اسلایدر صفحه اول»: the products the home page cover shows one at a time, in order. Search published products,
 * add them, reorder with the arrows and save. With nothing saved the storefront shows its discounted products. */
export function HomeSliderManager() {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [max, setMax] = useState(8);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Slide[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    const controller = new AbortController();
    adminApi<{ items: Slide[]; max: number }>('home-slider', { signal: controller.signal })
      .then(result => { setSlides(result.items); setSavedIds(result.items.map(item => item.id)); setMax(result.max); })
      .catch(error => { if (!controller.signal.aborted) setState({ tone: 'error', text: errorMessage(error) }); });
    return () => controller.abort();
  }, []);

  const ids = slides?.map(slide => slide.id) ?? [];
  const dirty = slides !== null && ids.join() !== savedIds.join();
  const unpublished = slides?.filter(slide => slide.status !== 'active') ?? [];
  const full = ids.length >= max;

  function move(index: number, delta: number) {
    setSlides(current => {
      if (!current) return current;
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
    setState(null);
  }
  const remove = (id: string) => { setSlides(current => current?.filter(slide => slide.id !== id) ?? null); setState(null); };
  const add = (slide: Slide) => { setSlides(current => current && !current.some(item => item.id === slide.id) ? [...current, slide] : current); setState(null); };

  async function search(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    try {
      const found = await adminApi<{ items: Slide[] }>('products?status=active&limit=8&q=' + encodeURIComponent(query.trim()));
      setResults(found.items);
    } catch (error) { setState({ tone: 'error', text: errorMessage(error) }); }
    finally { setSearching(false); }
  }
  async function save() {
    setBusy(true); setState(null);
    try {
      await adminApi('home-slider', { method: 'PUT', body: { productIds: ids } });
      setSavedIds(ids);
      setState({ tone: 'success', text: ids.length
        ? 'اسلایدر ذخیره شد؛ صفحه اول فروشگاه همین ترتیب را نشان می‌دهد.'
        : 'اسلایدر خالی ذخیره شد؛ صفحه اول محصولات تخفیف‌دار را نشان می‌دهد.' });
    } catch (error) { setState({ tone: 'error', text: errorMessage(error) }); }
    finally { setBusy(false); }
  }

  return <div className="admin-stack admin-narrow">
    <section className="admin-panel" aria-labelledby="slider-title">
      <div className="admin-panel-head"><div>
        <h2 id="slider-title"><GalleryHorizontal size={18} aria-hidden="true"/> اسلایدر صفحه اول</h2>
        <p>محصولاتی که بالای صفحه اول فروشگاه یکی‌یکی و هر چند ثانیه نمایش داده می‌شوند (حداکثر {formatNumber(max)} محصول).
          اگر فهرست خالی باشد، محصولات تخفیف‌دار خودکار نمایش داده می‌شوند.</p>
      </div></div>
      <div className="admin-panel-body admin-stack-sm">
        {slides === null ? (state ? null : <Loading label="در حال دریافت اسلایدر…"/>)
          : slides.length === 0 ? <p className="admin-sub">هنوز محصولی انتخاب نشده است؛ صفحه اول محصولات تخفیف‌دار را نشان می‌دهد.</p>
          : <ol className="admin-slide-list" aria-label="ترتیب اسلایدها">
            {slides.map((slide, index) => <li key={slide.id} className="admin-slide">
              <span className="admin-slide-no" aria-hidden="true">{formatNumber(index + 1)}</span>
              <Thumb slide={slide}/>
              <span className="admin-slide-info">
                <span className="admin-product-name">{slide.name}</span>
                <Prices slide={slide}/>
                {slide.status !== 'active' && <Badge tone={PRODUCT_STATUS[slide.status].tone}>{PRODUCT_STATUS[slide.status].label}</Badge>}
              </span>
              <span className="admin-slide-tools">
                <button type="button" className="admin-icon-btn" disabled={index === 0} onClick={() => move(index, -1)}
                  aria-label={'جلوتر بردن ' + slide.name}><ChevronUp size={18} aria-hidden="true"/></button>
                <button type="button" className="admin-icon-btn" disabled={index === slides.length - 1} onClick={() => move(index, 1)}
                  aria-label={'عقب‌تر بردن ' + slide.name}><ChevronDown size={18} aria-hidden="true"/></button>
                <button type="button" className="admin-icon-btn admin-icon-danger" onClick={() => remove(slide.id)}
                  aria-label={'حذف ' + slide.name + ' از اسلایدر'}><X size={18} aria-hidden="true"/></button>
              </span>
            </li>)}
          </ol>}
        {unpublished.length > 0 && <Notice tone="warning">
          محصول منتشرنشده در اسلایدر نمایش داده نمی‌شود و ذخیره را متوقف می‌کند؛ آن را از فهرست بردارید.</Notice>}
        {state && <Notice tone={state.tone}>{state.text}</Notice>}
        {slides !== null && <div className="admin-actions">
          <button type="button" className="admin-btn admin-btn-primary" disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? 'در حال ذخیره…' : 'ذخیره اسلایدر'}</button>
          {dirty && <span className="admin-sub">تغییرات هنوز ذخیره نشده است.</span>}
        </div>}
      </div>
    </section>

    <section className="admin-panel" aria-labelledby="slider-add-title">
      <div className="admin-panel-head"><div>
        <h2 id="slider-add-title"><Plus size={18} aria-hidden="true"/> افزودن محصول به اسلایدر</h2>
        <p>فقط محصولات منتشرشده قابل انتخاب‌اند و محصولات تخفیف‌دار با برچسب تخفیف نمایش داده می‌شوند.
          جست‌وجوی خالی، تازه‌ترین محصولات را نشان می‌دهد.</p>
      </div></div>
      <div className="admin-panel-body admin-stack-sm">
        <form role="search" onSubmit={search} className="admin-search-form">
          <label className="admin-search-field"><span className="sr-only">جست‌وجوی محصول برای اسلایدر</span>
            <Search size={17} aria-hidden="true"/>
            <input type="search" placeholder="نام یا کد محصول" value={query} onChange={event => setQuery(event.target.value)}/>
          </label>
          <button type="submit" className="admin-btn admin-btn-outline" disabled={searching}>جست‌وجو</button>
        </form>
        {results && (results.length === 0 ? <p className="admin-sub">محصول منتشرشده‌ای با این عبارت پیدا نشد.</p>
          : <ul className="admin-slide-list" aria-label="نتیجه جست‌وجو">
            {results.map(result => {
              const added = ids.includes(result.id);
              return <li key={result.id} className="admin-slide">
                <Thumb slide={result}/>
                <span className="admin-slide-info">
                  <span className="admin-product-name">{result.name}</span>
                  <Prices slide={result}/>
                </span>
                <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={added || full || slides === null}
                  onClick={() => add(result)} aria-label={(added ? 'در اسلایدر است: ' : 'افزودن به اسلایدر: ') + result.name}>
                  {added ? 'در اسلایدر' : 'افزودن'}</button>
              </li>;
            })}
          </ul>)}
        {full && <p className="admin-sub">اسلایدر پر است؛ برای افزودن، یکی از محصولات فعلی را بردارید.</p>}
      </div>
    </section>
  </div>;
}
