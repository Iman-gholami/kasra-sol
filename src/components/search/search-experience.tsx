'use client';

import { useEffect, useId, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpLeft, Clock3, RotateCw, Search, X } from 'lucide-react';
import { categories, palette } from '@/data/facets';
import { formatNumber, normalizePersian, toman } from '@/lib/format';

type SuggestionProduct = { id: string; name: string; category: string; image: string; price: number; href: string };
type SuggestionCategory = { slug: string; title: string; href: string };
type Suggestions = { products: SuggestionProduct[]; categories: SuggestionCategory[]; count: number };
type Status = 'idle' | 'loading' | 'ready' | 'error';
type Entry = { id: string; href: string; label: string; meta: string; image?: string };

const empty: Suggestions = { products: [], categories: [], count: 0 };

/* Recent searches: browser-only, separate key from the cart/wishlist store. */
const RECENT_KEY = 'kasra-recent-searches-v1';
const RECENT_LIMIT = 5;
let recentCache: string[] | null = null;
const recentListeners = new Set<() => void>();
function readRecent(): string[] {
  if (recentCache) return recentCache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    recentCache = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, RECENT_LIMIT) : [];
  } catch { recentCache = []; }
  return recentCache;
}
function writeRecent(next: string[]) {
  recentCache = next;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode: keep in memory */ }
  recentListeners.forEach(listener => listener());
}
export function rememberSearch(query: string) {
  const value = query.trim().slice(0, 60);
  if (normalizePersian(value).length < 2) return;
  writeRecent([value, ...readRecent().filter(item => normalizePersian(item) !== normalizePersian(value))].slice(0, RECENT_LIMIT));
}
const subscribeRecent = (listener: () => void) => { recentListeners.add(listener); return () => recentListeners.delete(listener); };
const noRecent: string[] = [];

export function SearchExperience({ inputRef, onClose, active }: { inputRef: RefObject<HTMLInputElement | null>; onClose: () => void; active: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestions>(empty);
  const [status, setStatus] = useState<Status>('idle');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const recent = useSyncExternalStore(subscribeRecent, readRecent, () => noRecent);
  const normalized = normalizePersian(query);
  const searching = normalized.length >= 2;

  const entries: Entry[] = [
    ...suggestions.products.map(p => ({ id: 'product-' + p.id, href: p.href, label: p.name, meta: p.category + '، ' + toman(p.price), image: p.image })),
    ...suggestions.categories.map(c => ({ id: 'category-' + c.slug, href: c.href, label: c.title, meta: 'دیدن دسته‌بندی' }))
  ];

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/search-suggestions?q=' + encodeURIComponent(query.trim()), { signal: controller.signal });
        if (!response.ok) throw new Error('Search unavailable');
        const result: Suggestions = await response.json();
        if (!controller.signal.aborted) { setSuggestions(result); setStatus('ready'); }
      } catch {
        if (!controller.signal.aborted) { setSuggestions(empty); setStatus('error'); }
      }
    }, 90);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, searching, attempt]);

  function change(value: string) {
    setQuery(value);
    setActiveIndex(-1);
    setSuggestions(empty);
    setStatus(normalizePersian(value).length >= 2 ? 'loading' : 'idle');
  }

  function go(href: string) {
    rememberSearch(query);
    onClose();
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Combobox convention: the first Escape clears the query (and its suggestions), the next one closes.
    if (event.key === 'Escape' && query) {
      event.preventDefault();
      change('');
      return;
    }
    if (!entries.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault(); setActiveIndex(index => (index + 1) % entries.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault(); setActiveIndex(index => (index <= 0 ? entries.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0 && entries[activeIndex]) {
      event.preventDefault(); go(entries[activeIndex].href);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!query.trim()) { event.preventDefault(); inputRef.current?.focus(); return; }
    rememberSearch(query);
  }

  const resultsHref = '/search?q=' + encodeURIComponent(query.trim());
  const statusText = status === 'loading' ? 'در حال جستجو…'
    : status === 'error' ? 'پیشنهادها در دسترس نیست'
    : status === 'ready' ? formatNumber(suggestions.count) + ' کالای نمایشی پیدا شد' : '';

  return <div className="sheet-inner search-panel">
    <div className="search-panel-top">
      <form action="/search" role="search" className="search-field" onSubmit={submit}>
        <Search size={20} aria-hidden="true"/>
        <input ref={inputRef} data-autofocus type="search" name="q" value={query} enterKeyHint="search"
          onChange={event => change(event.target.value)} onKeyDown={onKeyDown}
          role="combobox" aria-label="عبارت جستجو" aria-autocomplete="list" aria-expanded={searching && entries.length > 0}
          aria-controls={listId} aria-activedescendant={activeIndex >= 0 ? listId + '-' + activeIndex : undefined}
          placeholder="مثلاً شومیز سفید" autoComplete="off" autoCorrect="off" spellCheck={false}/>
        {query && <button type="button" className="icon-button search-clear" aria-label="پاک کردن عبارت جستجو"
          onClick={() => { change(''); inputRef.current?.focus(); }}><X size={18} aria-hidden="true"/></button>}
        <button type="submit" className="btn btn-primary btn-sm search-submit">جستجو</button>
      </form>
      <button type="button" className="icon-button search-close" aria-label="بستن جستجو" onClick={onClose}><X size={22} aria-hidden="true"/></button>
    </div>

    <div className="search-panel-body">
      <p className="sr-only" role="status" aria-live="polite">{active ? statusText : ''}</p>
      {!searching ? <div className="search-idle">
        {recent.length > 0 && <section aria-labelledby={listId + '-recent'}>
          <div className="search-group-head">
            <h2 id={listId + '-recent'}>جستجوهای اخیر</h2>
            <button type="button" className="link-button" onClick={() => writeRecent([])}>پاک کردن</button>
          </div>
          <ul className="search-recent">
            {recent.map(item => <li key={item}>
              <Link href={'/search?q=' + encodeURIComponent(item)} onClick={() => { rememberSearch(item); onClose(); }}>
                <Clock3 size={16} aria-hidden="true"/><span dir="auto">{item}</span>
              </Link>
            </li>)}
          </ul>
        </section>}
        <section aria-labelledby={listId + '-cats'}>
          <h2 id={listId + '-cats'} className="search-group-title">دسته‌بندی‌ها</h2>
          <ul className="search-chips">
            {categories.map(c => <li key={c.slug}><Link className="chip" href={'/category/' + c.slug} onClick={onClose}>{c.title}</Link></li>)}
          </ul>
        </section>
        <section aria-labelledby={listId + '-colors'}>
          <h2 id={listId + '-colors'} className="search-group-title">رنگ‌ها</h2>
          <ul className="search-chips">
            {palette.map(color => <li key={color.id}><Link className="chip" href={'/shop?color=' + color.id} onClick={onClose}>
              <span className="swatch-dot" style={{ backgroundColor: color.hex }} aria-hidden="true"/>{color.name}
            </Link></li>)}
          </ul>
        </section>
      </div> : <div className="search-results">
        <p className="search-results-head" aria-hidden="true">{statusText}</p>
        <div id={listId} role="listbox" aria-label="پیشنهادهای جستجو" className="search-experience-list">
          {status !== 'loading' && entries.map((entry, index) => <Link key={entry.id} id={listId + '-' + index}
            role="option" aria-selected={activeIndex === index} tabIndex={-1}
            className={'search-preview-item' + (activeIndex === index ? ' is-active' : '')}
            href={entry.href} onMouseEnter={() => setActiveIndex(index)} onClick={() => { rememberSearch(query); onClose(); }}>
            {entry.image
              ? <span className="search-preview-image"><Image src={entry.image} fill sizes="52px" alt=""/></span>
              : <span className="search-category-mark" aria-hidden="true"><ArrowUpLeft size={20}/></span>}
            <span className="search-preview-text"><span>{entry.label}</span><small>{entry.meta}</small></span>
          </Link>)}
          {status === 'loading' && [0, 1, 2].map(i => <span key={i} className="search-preview-skeleton" aria-hidden="true">
            <span className="skeleton"/><span className="skeleton"/></span>)}
        </div>
        {status === 'ready' && entries.length === 0 && <p className="search-message">
          <span>پیشنهادی برای «<span dir="auto">{query.trim()}</span>» پیدا نشد. جستجوی کامل یا دسته‌بندی‌ها را امتحان کن.</span>
        </p>}
        {status === 'error' && <p className="search-message search-message-error">
          اتصال برای پیشنهادها برقرار نشد. جستجوی کامل همچنان کار می‌کند.
          <button type="button" className="link-button" onClick={() => { setStatus('loading'); setAttempt(n => n + 1); }}>
            <RotateCw size={16} aria-hidden="true"/> تلاش دوباره
          </button>
        </p>}
        <Link className="text-link search-all-link" href={resultsHref} aria-label={'نمایش نتایج «' + query.trim() + '»'}
          onClick={() => { rememberSearch(query); onClose(); }}>
          {/* One flex item for the label, so the link's gap only separates it from the arrow, not the quotes. */}
          <span>نمایش نتایج «<span dir="auto">{query.trim()}</span>»</span><ArrowLeft size={18} aria-hidden="true"/>
        </Link>
      </div>}
    </div>
    <p className="search-disclaimer">نتایج از کاتالوگ نمایشی کسری‌اند و تصاویر کالاها نمونه هستند.</p>
  </div>;
}
