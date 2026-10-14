'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react';
import { Sheet, useMountedOnce } from '@/components/ui/sheet';
import { formatNumber } from '@/lib/format';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Product gallery: a native scroll-snap track (finger-follow, momentum, snap, correct RTL direction,
 * trackpad swipes on desktop) with buttons, thumbnails and dots as non-gesture alternatives. */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomMounted = useMountedOnce(zoomOpen);
  const track = useRef<HTMLDivElement>(null);
  // While a button/thumbnail-driven scroll animates, intermediate positions must not move the index.
  const programmatic = useRef<number | null>(null);
  const count = images.length;

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const position = Math.abs(node.scrollLeft) / Math.max(1, node.clientWidth);
        if (programmatic.current !== null) {
          if (Math.abs(position - programmatic.current) > 0.02) return;
          programmatic.current = null;
        }
        const next = Math.min(count - 1, Math.round(position));
        setIndex(current => (current === next ? current : next));
      });
    };
    const userTakesOver = () => { programmatic.current = null; };
    node.addEventListener('scroll', onScroll, { passive: true });
    node.addEventListener('pointerdown', userTakesOver, { passive: true });
    node.addEventListener('touchstart', userTakesOver, { passive: true });
    node.addEventListener('wheel', userTakesOver, { passive: true });
    return () => {
      node.removeEventListener('scroll', onScroll);
      node.removeEventListener('pointerdown', userTakesOver);
      node.removeEventListener('touchstart', userTakesOver);
      node.removeEventListener('wheel', userTakesOver);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  function show(target: number, smooth = true) {
    const next = (target + count) % count;
    programmatic.current = next;
    setIndex(next);
    const node = track.current;
    if (!node) return;
    const sign = getComputedStyle(node).direction === 'rtl' ? -1 : 1;
    node.scrollTo({ left: sign * next * node.clientWidth, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  }

  const activeSlide = () => track.current?.querySelector<HTMLElement>('[data-slide="' + index + '"]') ?? null;

  return <div className="pdp-gallery-column">
    <div className="pdp-gallery-frame">
      {count > 1 && <div className="gallery-thumbs" role="group" aria-label="تصاویر محصول">
        {images.map((image, i) => <button key={image + i} type="button" className={'gallery-thumb' + (i === index ? ' selected' : '')}
          aria-label={'نمایش تصویر ' + formatNumber(i + 1)} aria-pressed={i === index} onClick={() => show(i)}>
          <Image src={image} alt="" fill sizes="72px" loading="lazy"/>
        </button>)}
      </div>}
      <div className="pdp-gallery">
        <div className="pdp-track" ref={track} tabIndex={-1}>
          {images.map((image, i) => <button key={image + i} type="button" className="gallery-main pdp-slide" data-slide={i}
            aria-hidden={i !== index || undefined} tabIndex={i === index ? 0 : -1}
            aria-label={'بزرگ‌نمایی تصویر ' + formatNumber(i + 1) + ' محصول'}
            onClick={() => { setIndex(i); setZoomOpen(true); }}>
            <Image src={image} alt={'تصویر نمایشی ساخته‌شده با هوش مصنوعی برای ' + name + '، تصویر ' + formatNumber(i + 1)}
              fill preload={i === 0} fetchPriority={i === 0 ? 'high' : undefined} loading={i === 0 ? undefined : 'lazy'}
              sizes="(max-width: 600px) 100vw, (max-width: 1080px) 48vw, 620px"/>
          </button>)}
        </div>
        <span className="gallery-demo-label">تصویر نمایشی</span>
        {count > 1 && <>
          <button type="button" className="pdp-gallery-arrow pdp-gallery-prev" aria-label="تصویر قبلی" onClick={() => show(index - 1)}>
            <ChevronRight size={22} aria-hidden="true"/></button>
          <button type="button" className="pdp-gallery-arrow pdp-gallery-next" aria-label="تصویر بعدی" onClick={() => show(index + 1)}>
            <ChevronLeft size={22} aria-hidden="true"/></button>
          <span className="pdp-gallery-counter" aria-hidden="true">{formatNumber(index + 1)} / {formatNumber(count)}</span>
          <span className="gallery-dots" aria-hidden="true">
            {images.map((image, i) => <span key={image + i} className={i === index ? 'is-active' : undefined}/>)}
          </span>
          <p className="sr-only" aria-live="polite" aria-atomic="true">تصویر {formatNumber(index + 1)} از {formatNumber(count)}</p>
        </>}
      </div>
    </div>
    {zoomMounted && <Sheet open={zoomOpen} onClose={() => setZoomOpen(false)} label="نمای بزرگ محصول" className="sheet-center zoom-dialog"
      returnFocus={activeSlide}>
      <ZoomView images={images} name={name} index={index} onIndex={i => show(i, false)} onClose={() => setZoomOpen(false)}/>
    </Sheet>}
  </div>;
}

function ZoomView({ images, name, index, onIndex, onClose }: { images: string[]; name: string; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 30 });
  const stage = useRef<HTMLDivElement>(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const pan = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const count = images.length;

  const point = (event: PointerEvent<HTMLDivElement>) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: Math.min(100, Math.max(0, ((event.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((event.clientY - r.top) / r.height) * 100)) };
  };
  function toggleAt(event: PointerEvent<HTMLDivElement>) {
    setOrigin(point(event));
    setScale(value => (value > 1 ? 1 : 2));
  }
  function go(i: number) { setScale(1); onIndex(i); }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (pan.current?.x !== undefined && Math.hypot(event.clientX - pan.current.x, event.clientY - pan.current.y) > 6) { pan.current = null; return; }
    pan.current = null;
    if (event.pointerType === 'mouse') { toggleAt(event); return; }
    const now = performance.now();
    const last = lastTap.current;
    if (now - last.t < 300 && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 30) {
      toggleAt(event);
      lastTap.current = { t: 0, x: 0, y: 0 };
    } else lastTap.current = { t: now, x: event.clientX, y: event.clientY };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (scale === 1) return;
    if (event.pointerType === 'mouse') { setOrigin(point(event)); return; }
    const start = pan.current;
    if (!start) return;
    const r = stage.current!.getBoundingClientRect();
    setOrigin({
      x: Math.min(100, Math.max(0, start.ox - ((event.clientX - start.x) / r.width) * 100)),
      y: Math.min(100, Math.max(0, start.oy - ((event.clientY - start.y) / r.height) * 100))
    });
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    if (scale > 1 && event.key.startsWith('Arrow')) {
      event.preventDefault();
      const step = 12;
      setOrigin(o => ({
        x: Math.min(100, Math.max(0, o.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))),
        y: Math.min(100, Math.max(0, o.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)))
      }));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const forward = (event.key === 'ArrowLeft') === rtl;
      go(index + (forward ? 1 : -1));
    } else if (event.key === '+' || event.key === '=') { setScale(2); }
    else if (event.key === '-') { setScale(1); }
  }

  return <div className="sheet-inner zoom-inner" onKeyDown={onKeyDown}>
    <div className="zoom-top">
      <p className="zoom-hint" id="zoom-hint">{scale > 1 ? 'برای جابه‌جایی بکش یا از کلیدهای جهت استفاده کن.' : 'برای بزرگ‌نمایی ضربه بزن یا دوبار لمس کن.'}</p>
      <button type="button" className="icon-button close-zoom" onClick={onClose} aria-label="بستن بزرگ‌نمایی"><X size={22} aria-hidden="true"/></button>
    </div>
    <div ref={stage} className={'zoom-image' + (scale > 1 ? ' is-zoomed' : '')} role="img"
      aria-label={'نمای بزرگ ' + name + '، تصویر ' + formatNumber(index + 1)} aria-describedby="zoom-hint"
      onPointerDown={event => { pan.current = { x: event.clientX, y: event.clientY, ox: origin.x, oy: origin.y }; }}
      onPointerUp={onPointerUp} onPointerMove={onPointerMove} onPointerCancel={() => { pan.current = null; }}>
      <Image src={images[index]} alt="" fill sizes="(max-width: 700px) 100vw, 640px"
        style={{ transform: 'scale(' + scale + ')', transformOrigin: origin.x + '% ' + origin.y + '%' }}/>
    </div>
    <div className="pdp-zoom-controls">
      <button type="button" className="icon-button" onClick={() => go(index - 1)} aria-label="تصویر قبلی" disabled={count < 2}><ChevronRight size={22} aria-hidden="true"/></button>
      <span aria-live="polite">{formatNumber(index + 1)} / {formatNumber(count)}</span>
      <button type="button" className="icon-button" onClick={() => go(index + 1)} aria-label="تصویر بعدی" disabled={count < 2}><ChevronLeft size={22} aria-hidden="true"/></button>
      <button type="button" className="icon-button zoom-toggle" onClick={() => setScale(value => (value > 1 ? 1 : 2))}
        aria-label={scale > 1 ? 'بازگشت به اندازه عادی' : 'بزرگ‌نمایی بیشتر'} aria-pressed={scale > 1}>
        {scale > 1 ? <Minus size={20} aria-hidden="true"/> : <Plus size={20} aria-hidden="true"/>}
      </button>
    </div>
  </div>;
}
