'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { categories } from '@/data/facets';
import { toman, normalizePersian } from '@/lib/format';

type SuggestionProduct = { id:string; name:string; category:string; image:string; price:number; href:string };
type SuggestionCategory = {slug:string; title:string; href:string};
type Suggestions = {products: SuggestionProduct[]; categories: SuggestionCategory[]; count:number};
const empty:Suggestions = {products:[],categories:[],count:0};

export function SearchExperience({onClose}:{onClose:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const listId = useId();
  const [query,setQuery] = useState('');
  const [suggestions,setSuggestions] = useState<Suggestions>(empty);
  const [loading,setLoading] = useState(false);
  const [active,setActive] = useState(-1);
  const entries = [
    ...suggestions.categories.map(c => ({kind:'category',label:c.title,href:c.href,id:'category-'+c.slug})),
    ...suggestions.products.map(p => ({kind:'product',label:p.name,href:p.href,id:'product-'+p.id}))
  ];
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    input.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; if (node.open) node.close(); };
  }, []);
  useEffect(() => {
    const normalized = normalizePersian(query);
    if (normalized.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/search-suggestions?q='+encodeURIComponent(query.trim()),
          {signal:controller.signal});
        if (!response.ok) throw new Error('Search unavailable');
        const result:Suggestions = await response.json();
        if (!controller.signal.aborted) { setSuggestions(result); setLoading(false); }
      } catch (error) {
        if (!controller.signal.aborted) { setSuggestions(empty); setLoading(false); }
        void error;
      }
    }, 90);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  function change(value:string) {
    setQuery(value);setActive(-1);
    setSuggestions(empty);
    setLoading(normalizePersian(value).length>=2);
  }
  function close() { dialog.current?.close(); }
  function go(href:string) { close(); router.push(href); }
  function keys(event:KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && entries.length) {
      event.preventDefault();setActive(index=>(index+1)%entries.length);
    } else if (event.key === 'ArrowUp' && entries.length) {
      event.preventDefault();setActive(index=>index<=0?entries.length-1:index-1);
    } else if (event.key === 'Enter' && active>=0 && entries[active]) {
      event.preventDefault();go(entries[active].href);
    }
  }
  return <dialog ref={dialog} className="search-experience-dialog" aria-label="جستجو در محصولات کسری"
    onClose={onClose} onClick={event=>{if(event.target===dialog.current) close();}}>
    <div className="search-experience-inner">
      <div className="search-experience-heading">
        <div><p className="section-kicker">جستجو در کسری</p><h2>دنبال چه لباسی می‌گردی؟</h2></div>
        <button type="button" className="icon-button" aria-label="بستن جستجو" onClick={close}><X size={23}/></button>
      </div>
      <form action="/search" role="search" className="search-line search-experience-form">
        <Search size={21} aria-hidden="true"/>
        <input ref={input} type="search" name="q" value={query}
          onChange={event=>change(event.target.value)} onKeyDown={keys}
          role="combobox" aria-label="عبارت جستجو" aria-autocomplete="list"
          aria-expanded={normalizePersian(query).length>=2}
          aria-controls={listId} aria-activedescendant={active>=0?listId+'-'+active:undefined}
          placeholder="مثلاً شومیز سفید..." autoComplete="off"/>
        {query && <button type="button" className="search-clear" onClick={()=>{change('');input.current?.focus();}}
          aria-label="پاک کردن عبارت جستجو"><X size={18}/></button>}
        <button type="submit" className="btn btn-dark">جستجو</button>
      </form>
      {normalizePersian(query).length<2
        ? <div className="search-suggestions search-experience-popular">
            <span>دسته‌بندی‌ها</span>
            {categories.map(c=><Link href={'/category/'+c.slug} key={c.slug}
              onClick={()=>go('/category/'+c.slug)}>{c.title}</Link>)}
          </div>
        : <div className="search-preview">
            <p className="search-preview-heading">پیشنهادهای مرتبط
              <span aria-live="polite">{loading ? 'در حال جستجو...' : suggestions.count.toLocaleString('fa-IR')+' نتیجه نمایشی'}</span>
            </p>
            <div id={listId} role="listbox" aria-label="پیشنهادهای جستجو" className="search-experience-list">
              {!loading && entries.map((entry,index)=><Link
                key={entry.id} id={listId+'-'+index} role="option" aria-selected={active===index}
                className={'search-preview-item'+(active===index?' is-active':'')}
                href={entry.href} onMouseEnter={()=>setActive(index)}
                onClick={event=>{event.preventDefault();go(entry.href);}}>
                {entry.kind==='product'
                  ? <span className="search-preview-image">
                      <Image src={suggestions.products.find(p=>p.href===entry.href)!.image}
                        fill sizes="54px" alt="" />
                    </span>
                  : <span className="search-experience-category-mark" aria-hidden="true">↗</span>}
                <span>{entry.label}
                  <small>{entry.kind==='product'
                    ? suggestions.products.find(p=>p.href===entry.href)!.category+' · '+toman(suggestions.products.find(p=>p.href===entry.href)!.price)
                    : 'دیدن دسته‌بندی'}</small>
                </span>
              </Link>)}
              {!loading && entries.length===0 && <p className="search-preview-empty">پیشنهادی پیدا نشد؛ جستجوی کامل را امتحان کن.</p>}
              {loading && <p className="search-preview-empty" role="status">در حال یافتن محصولات مرتبط...</p>}
            </div>
            <Link className="search-all-link" href={'/search?q='+encodeURIComponent(query.trim())}
              onClick={event=>{event.preventDefault();go('/search?q='+encodeURIComponent(query.trim()));}}>
              نمایش نتایج «{query.trim()}» ←
            </Link>
          </div>}
      <p className="search-experience-disclaimer">نتایج براساس کاتالوگ نمایشی کسری‌اند؛ تصاویر کالاها نمونه هستند.</p>
    </div>
  </dialog>;
}
