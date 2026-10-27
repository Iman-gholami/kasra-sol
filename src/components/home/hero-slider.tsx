'use client';

import { useEffect, useState, useSyncExternalStore, useRef, type PointerEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Pause, Play } from 'lucide-react';
import { Price } from '@/components/products/price';
import { isDemoPhoto } from '@/lib/demo-photos';
import { discountPercent, formatNumber, formatPercent } from '@/lib/format';

export type HeroSlide = { id: string; slug: string; name: string; image: string; price: number; compareAt?: number };

const REDUCE = '(prefers-reduced-motion: reduce)';
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};

/** The cover slider: the owner's picks (or discounted products), one at a time in the studio room. The first slide is
 * server-rendered and is the page's LCP image; the other photos load once the browser is idle, so they never compete
 * with it. A progress bar times each slide (5s, CSS) and the slider moves on when it fills. The pause button stops it
 * (WCAG 2.2.2), and so do hovering it and focusing inside it; with reduced motion it never moves by itself. The bar's
 * segments and a horizontal swipe move it by hand. */
export function HeroSlider({ slides, sizes }: { slides: HeroSlide[]; sizes: string }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [rest, setRest] = useState(false);
  // False on the server and until hydration, so nothing advances before the handlers exist.
  const motion = useSyncExternalStore(subscribe, () => !window.matchMedia(REDUCE).matches, () => false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const autoplay = motion && count > 1;

  useEffect(() => {
    if (count < 2) return;
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(() => setRest(true), { timeout: 2500 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = setTimeout(() => setRest(true), 1500);
    return () => clearTimeout(timer);
  }, [count]);

  const go = (target: number) => setIndex((target + count) % count);
  const next = () => setIndex(current => (current + 1) % count);

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || count < 2) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    // In RTL the next slide waits on the left, so a drag to the right reveals it, like the product galleries.
    const forward = getComputedStyle(event.currentTarget).direction === 'rtl' ? dx > 0 : dx < 0;
    go(index + (forward ? 1 : -1));
  }

  return <div className="hero-stage" role="region" aria-roledescription="اسلایدر" aria-label="محصولات ویژه"
    data-autoplay={autoplay || undefined} data-paused={paused || held || undefined}
    onPointerEnter={event => { if (event.pointerType === 'mouse') setHeld(true); }}
    onPointerLeave={event => { if (event.pointerType === 'mouse') setHeld(false); }}
    onFocus={() => setHeld(true)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false); }}>
    {count > 1 && <div className="hero-controls">
      <div className="hero-segments">
        {slides.map((slide, i) => <button key={slide.id} type="button" className="hero-segment"
          data-state={i < index ? 'done' : i === index ? 'current' : undefined}
          aria-label={'اسلاید ' + formatNumber(i + 1) + ' از ' + formatNumber(count)} aria-current={i === index || undefined}
          onClick={() => go(i)}>
          <span className="hero-segment-fill" onAnimationEnd={i === index ? next : undefined}/>
        </button>)}
      </div>
      {/* Rendered from the server so the segments never narrow when it appears; CSS hides it with reduced motion. */}
      <button type="button" className="hero-pause" onClick={() => setPaused(value => !value)}
        aria-label={paused ? 'پخش خودکار اسلایدها' : 'توقف خودکار اسلایدها'}>
        {paused ? <Play size={16} aria-hidden="true"/> : <Pause size={16} aria-hidden="true"/>}
      </button>
    </div>}
    <div className="hero-slides" aria-live={autoplay && !paused ? 'off' : 'polite'}
      onPointerDown={event => { swipe.current = { x: event.clientX, y: event.clientY }; }}
      onPointerUp={onPointerUp} onPointerCancel={() => { swipe.current = null; }}>
      {slides.map((slide, i) => {
        const discount = discountPercent(slide.price, slide.compareAt);
        return <div key={slide.id} className="hero-slide" data-active={i === index || undefined} role="group" aria-roledescription="اسلاید"
          aria-label={formatNumber(i + 1) + ' از ' + formatNumber(count)} aria-hidden={i !== index || undefined} inert={i !== index}>
          {/* Like product cards: the photo repeats the name link, so it stays out of the tab order and the accessibility tree.
              A studio photo shares the room's gray, so its model stands in the room; any other photo hangs as a framed plate. */}
          <Link href={'/product/' + slide.slug} className={'hero-figure' + (i === 0 ? ' hero-visual' : '') + (isDemoPhoto(slide.image) ? ' hero-figure-studio' : '')} tabIndex={-1} aria-hidden="true">
            {(i === 0 || rest) && <Image src={slide.image} alt="" fill sizes={sizes} preload={i === 0}
              fetchPriority={i === 0 ? 'high' : 'low'}/>}
          </Link>
          <Link href={'/product/' + slide.slug} className="hero-tag">
            {discount > 0 && <span className="hero-tag-badge">{formatPercent(discount)} تخفیف</span>}
            <span className="hero-tag-name">{slide.name}</span>
            <Price price={slide.price} compareAt={slide.compareAt}/>
          </Link>
        </div>;
      })}
    </div>
  </div>;
}
