'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronUp, GalleryHorizontal, ImageIcon, Plus, Search, X } from 'lucide-react';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { formatNumber, formatToman, PRODUCT_STATUS } from '@/components/admin/labels';
import { Badge, Loading, Notice } from '@/components/admin/ui';
import type { ProductRow } from '@/components/admin/product-list';

type Slide = Pick<ProductRow, 'id' | 'name' | 'price' | 'compareAt' | 'images' | 'status'>;
type State = { tone: 'error' | 'success' | 'warning'; text: string } | null;
const UNSAVED_SLIDES = 'ترتیب ذخیره‌نشده اسلایدر از بین می‌رود. ادامه می‌دهید؟';

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
export function HomeSliderManager({ onUnsaved }: { onUnsaved?: (question: string | null) => void }) {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [max, setMax] = useState(5);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [results, setResults] = useState<Slide[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [allProducts, setAllProducts] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(true);
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
  // Like the product editor: the dashboard asks before switching sections, the browser before closing or reloading.
  useEffect(() => { onUnsaved?.(dirty ? UNSAVED_SLIDES : null); }, [dirty, onUnsaved]);
  useEffect(() => () => onUnsaved?.(null), [onUnsaved]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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
  const add = (slide: Slide) => { setSlides(current => current && !current.some(item => item.id === slide.id) ? [...current, slide] : current); setState(null); setAdding(false); setResults(null); };

  async function loadProducts(nextPage: number, showAll: boolean, term = query) {
    setSearching(true); setState(null);
    try {
      const params = new URLSearchParams({
        status: 'active', limit: '12', page: String(nextPage),
        ...(showAll ? {} : { q: term.trim() })
      });
      const found = await adminApi<{ items: Slide[]; pages: number }>('products?' + params);
      setResults(found.items);
      setPages(Math.max(1, found.pages ?? 1));
      setPage(nextPage);
      setAllProducts(showAll);
      setAdding(true);
    } catch (error) { setState({ tone: 'error', text: errorMessage(error) }); }
    finally { setSearching(false); }
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    await loadProducts(1, false);
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
      <div className="admin-panel-head">
        <div>
          <h2 id="slider-title"><GalleryHorizontal size={18} aria-hidden="true"/> اسلایدر صفحه اول</h2>
          <p>اسلایدهای فعلی و ترتیب نمایش در صفحه اول فروشگاه</p>
        </div>
        <Link href="/" target="_blank" rel="noopener noreferrer" className="admin-btn admin-btn-outline admin-btn-small">
          مشاهده صفحه اول
        </Link>
      </div>
      <div className="admin-panel-body admin-stack-sm">
        {slides === null ? (state ? null : <Loading label="در حال دریافت اسلایدر…"/>)
          : <>
            <section className="admin-slider-live" aria-label="پیش‌نمایش صفحه اول">
              <div className="admin-slider-live-head">
                <div><strong>پیش‌نمایش فعلی فروشگاه</strong><p className="admin-sub">نمای واقعی صفحه اول، در ابعاد کوچک؛ تغییرات ذخیره‌نشده هنوز در آن دیده نمی‌شوند.</p></div>
                <button type="button" className="admin-btn admin-btn-outline admin-btn-small"
                  onClick={() => setPreviewOpen(open => !open)} aria-expanded={previewOpen}>
                  {previewOpen ? 'بستن پیش‌نمایش' : 'نمایش پیش‌نمایش'}
                </button>
              </div>
              {previewOpen && <div className="admin-slider-live-viewport">
                <iframe title="نمای کوچک صفحه اول فروشگاه" src="/" loading="lazy" tabIndex={-1}/>
              </div>}
            </section>
            <div className="admin-slider-summary">
              <strong>{slides.length ? formatNumber(slides.length) + ' اسلاید انتخاب‌شده' : 'حالت نمایش خودکار'}</strong>
              <span className="admin-sub">{slides.length
                ? 'اسلاید اول در بالای فهرست نمایش داده می‌شود. تصویر هر محصول، تصویر فعلی همان محصول است.'
                : 'هنوز اسلایدر دستی ذخیره نشده؛ سایت به‌صورت خودکار محصولات تخفیف‌دار را نمایش می‌دهد.'}</span>
            </div>
            {slides.length > 0 && <ol className="admin-slide-list admin-slider-current" aria-label="اسلایدهای فعلی به ترتیب نمایش">
              {slides.map((slide, index) => <li key={slide.id} className="admin-slide">
                <span className="admin-slide-no" aria-hidden="true">{formatNumber(index + 1)}</span>
                <Thumb slide={slide}/>
                <span className="admin-slide-info">
                  <span className="admin-product-name">{slide.name}</span>
                  <Prices slide={slide}/>
                  {slide.status !== 'active' && <Badge tone={PRODUCT_STATUS[slide.status].tone}>{PRODUCT_STATUS[slide.status].label}</Badge>}
                </span>
                <span className="admin-slide-tools">
                  <button type="button" className="admin-icon-btn" disabled={index === 0 || busy} onClick={() => move(index, -1)}
                    aria-label={'جلوتر بردن ' + slide.name}><ChevronUp size={18} aria-hidden="true"/></button>
                  <button type="button" className="admin-icon-btn" disabled={index === slides.length - 1 || busy} onClick={() => move(index, 1)}
                    aria-label={'عقب‌تر بردن ' + slide.name}><ChevronDown size={18} aria-hidden="true"/></button>
                  <button type="button" className="admin-icon-btn admin-icon-danger" disabled={busy} onClick={() => remove(slide.id)}
                    aria-label={'برداشتن ' + slide.name + ' از اسلایدر'}><X size={18} aria-hidden="true"/></button>
                </span>
              </li>)}
            </ol>}
            <div className="admin-slider-bottom">
              <button type="button" className="admin-btn admin-btn-outline admin-btn-small"
                onClick={() => setAdding(open => !open)} aria-expanded={adding} aria-controls="slider-add-panel" disabled={full && !adding}>
                <Plus size={16} aria-hidden="true"/> {adding ? 'بستن انتخاب محصول' : 'افزودن محصول'}
              </button>
              <span className="admin-sub">{formatNumber(slides.length)} از {formatNumber(max)} جایگاه</span>
              <button type="button" className="admin-btn admin-btn-primary admin-btn-small" disabled={!dirty || busy || unpublished.length > 0}
                onClick={() => void save()}>{busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</button>
            </div>
            {dirty && <p className="admin-sub" role="status">تغییرات هنوز ذخیره نشده‌اند.</p>}
            {unpublished.length > 0 && <Notice tone="warning">
              محصولات منتشرنشده نمی‌توانند در اسلایدر ذخیره شوند؛ ابتدا آن‌ها را بردارید.</Notice>}
            {adding && <div id="slider-add-panel" className="admin-slider-picker">
              <form role="search" onSubmit={search} className="admin-search-form">
                <label className="admin-search-field"><span className="sr-only">جست‌وجوی محصول برای اسلایدر</span>
                  <Search size={17} aria-hidden="true"/>
                  <input type="search" placeholder="نام یا کد محصول" value={query} onChange={event => setQuery(event.target.value)}/>
                </label>
                <button type="submit" className="admin-btn admin-btn-outline" disabled={searching}>{searching ? 'در حال جست‌وجو…' : 'جست‌وجو'}</button>
                <button type="button" className="admin-btn admin-btn-outline" disabled={searching}
                  onClick={() => { setQuery(''); void loadProducts(1, true, ''); }}>مشاهده همه محصولات</button>
              </form>
              {results && (results.length === 0 ? <p className="admin-sub">محصولی پیدا نشد.</p>
                : <ul className="admin-slide-list" aria-label="نتایج جست‌وجوی محصول">
                  {results.map(result => {
                    const added = ids.includes(result.id);
                    return <li key={result.id} className="admin-slide">
                      <Thumb slide={result}/>
                      <span className="admin-slide-info"><span className="admin-product-name">{result.name}</span><Prices slide={result}/></span>
                      <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={added || full || busy}
                        onClick={() => add(result)}>{added ? 'انتخاب‌شده' : 'افزودن'}</button>
                    </li>;
                  })}
                </ul>)}
              {results && <div className="admin-slider-pages">
                <span className="admin-sub">{allProducts ? 'همه محصولات منتشرشده' : 'نتایج جست‌وجو'} · صفحه {formatNumber(page)} از {formatNumber(pages)}</span>
                <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={page <= 1 || searching}
                  onClick={() => void loadProducts(page - 1, allProducts)}>قبلی</button>
                <button type="button" className="admin-btn admin-btn-outline admin-btn-small" disabled={page >= pages || searching}
                  onClick={() => void loadProducts(page + 1, allProducts)}>بعدی</button>
              </div>}
            </div>}
            {full && <p className="admin-sub">ظرفیت اسلایدر کامل است. برای افزودن، یکی از اسلایدها را بردارید.</p>}
          </>}
        {state && <Notice tone={state.tone}>{state.text}</Notice>}
      </div>
    </section>
  </div>;
}
