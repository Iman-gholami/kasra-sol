'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ImageIcon, Tag } from 'lucide-react';
import { adminApi, errorMessage } from '@/components/admin/admin-api';
import { formatNumber, formatToman } from '@/components/admin/labels';
import { Loading, Notice } from '@/components/admin/ui';
import { toLatinDigits } from '@/lib/format';
import { LAST_PIECE_PERCENT } from '@/lib/last-piece-discount';

type Piece = { productId: string; slug: string; name: string; image: string | null; colorId: string; colorName: string;
  size: string; price: number; compareAt: number | null; offerPrice: number; ownSaleWins: boolean };
type Setting = { enabled: boolean; percent: number; updatedAt: string | null; variants: Piece[] };
type State = { tone: 'error' | 'success'; text: string } | null;
const UNSAVED = 'تغییرات ذخیره‌نشده تخفیف آخرین دونه‌ها از بین می‌رود. ادامه می‌دهید؟';
const RANGE_ERROR = 'درصد باید عددی صحیح بین ' + formatNumber(LAST_PIECE_PERCENT.min) + ' تا ' + formatNumber(LAST_PIECE_PERCENT.max) + ' باشد.';

/** A whole percent within the allowed range, typed in Persian or Latin digits; null otherwise. */
function parsePercent(value: string): number | null {
  const latin = toLatinDigits(value.trim());
  if (!/^\d+$/.test(latin)) return null;
  const n = Number(latin);
  return n >= LAST_PIECE_PERCENT.min && n <= LAST_PIECE_PERCENT.max ? n : null;
}

/** «تخفیف آخرین دونه‌ها»: the switch and percent for colours and sizes with exactly one unit left on the website (the
 * shop counter is not affected), and the variants it applies to now. Saving needs the price permission. */
export function LastPieceDiscount({ canEdit, onUnsaved }: { canEdit: boolean; onUnsaved?: (question: string | null) => void }) {
  const [saved, setSaved] = useState<Setting | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<State>(null);
  const [fieldError, setFieldError] = useState('');

  function show(result: Setting) {
    setSaved(result);
    setEnabled(result.enabled);
    setPercent(formatNumber(result.percent));
  }
  useEffect(() => {
    const controller = new AbortController();
    adminApi<Setting>('last-piece-discount', { signal: controller.signal })
      .then(show)
      .catch(error => { if (!controller.signal.aborted) setState({ tone: 'error', text: errorMessage(error) }); });
    return () => controller.abort();
  }, []);

  const dirty = saved !== null && (enabled !== saved.enabled || parsePercent(percent) !== saved.percent);
  // Like the other sections: the dashboard asks before switching sections, the browser before closing or reloading.
  useEffect(() => { onUnsaved?.(dirty ? UNSAVED : null); }, [dirty, onUnsaved]);
  useEffect(() => () => onUnsaved?.(null), [onUnsaved]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save() {
    const value = parsePercent(percent);
    setState(null);
    if (value === null) { setFieldError(RANGE_ERROR); return; }
    setFieldError('');
    setBusy(true);
    try {
      await adminApi('last-piece-discount', { method: 'PUT', body: { enabled, percent: value } });
      show(await adminApi<Setting>('last-piece-discount'));
      setState({ tone: 'success', text: enabled
        ? 'تخفیف آخرین دونه‌ها ذخیره شد؛ رنگ و سایزهای تک‌دونه روی سایت با ' + formatNumber(value) + '٪ تخفیف فروخته می‌شوند.'
        : 'تخفیف آخرین دونه‌ها ذخیره شد؛ خاموش است و قیمت‌ها همان قیمت محصول است.' });
    } catch (error) { setState({ tone: 'error', text: errorMessage(error) }); }
    finally { setBusy(false); }
  }

  return <div className="admin-stack admin-narrow">
    <section className="admin-panel" aria-labelledby="last-piece-title">
      <div className="admin-panel-head"><div>
        <h2 id="last-piece-title"><Tag size={18} aria-hidden="true"/> تخفیف آخرین دونه‌ها</h2>
        <p>هر رنگ و سایزی که فقط یک عدد از آن مانده، روی سایت با این درصد تخفیف فروخته می‌شود و با شارژ دوباره یا فروش
          خودکار برمی‌گردد. اگر خود محصول تخفیف بیشتری داشته باشد، همان می‌ماند. فروش حضوری تغییر نمی‌کند.</p>
      </div></div>
      <div className="admin-panel-body admin-stack-sm">
        {saved === null ? (state ? null : <Loading label="در حال دریافت تنظیمات…"/>) : <>
          {!canEdit && <Notice tone="info">برای تغییر تخفیف، مجوز «تغییر قیمت» لازم است.</Notice>}
          <label className="admin-check">
            <input type="checkbox" checked={enabled} disabled={!canEdit || busy} onChange={event => { setEnabled(event.target.checked); setState(null); }}/>
            <span>تخفیف آخرین دونه‌ها روشن باشد<small>فقط رنگ و سایزهایی که موجودی‌شان دقیقاً یک عدد است.</small></span>
          </label>
          <label className="admin-field">درصد تخفیف ({formatNumber(LAST_PIECE_PERCENT.min)} تا {formatNumber(LAST_PIECE_PERCENT.max)})
            <input type="text" inputMode="numeric" value={percent} disabled={!canEdit || busy} aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? 'last-piece-percent-error' : undefined}
              onChange={event => { setPercent(event.target.value); setFieldError(''); setState(null); }}/>
          </label>
          {fieldError && <p className="admin-field-error" id="last-piece-percent-error" role="alert">{fieldError}</p>}
          {state && <Notice tone={state.tone}>{state.text}</Notice>}
          {canEdit && <div className="admin-actions">
            <button type="button" className="admin-btn admin-btn-primary" disabled={!dirty || busy} onClick={() => void save()}>ذخیره تخفیف</button>
          </div>}
        </>}
        {saved === null && state && <Notice tone={state.tone}>{state.text}</Notice>}
      </div>
    </section>

    {saved && <section className="admin-panel" aria-labelledby="last-piece-list-title">
      <div className="admin-panel-head"><div>
        <h2 id="last-piece-list-title">رنگ و سایزهای تک‌دونه ({formatNumber(saved.variants.length)})</h2>
        <p>قیمت با تخفیف با درصد ذخیره‌شده حساب شده است{saved.enabled ? '' : '؛ تا روشن نشود روی سایت اعمال نمی‌شود'}.</p>
      </div></div>
      <div className="admin-panel-body">
        {saved.variants.length === 0 ? <p className="admin-sub">الان هیچ رنگ و سایزی تک‌دونه نیست.</p>
          : <ul className="admin-slide-list" aria-label="رنگ و سایزهای تک‌دونه">
            {saved.variants.map(piece => <li key={piece.productId + ':' + piece.colorId + ':' + piece.size} className="admin-slide admin-last-piece">
              <span className="admin-product-image">
                {piece.image ? <Image src={piece.image} alt="" width={54} height={62} unoptimized/> : <ImageIcon size={22} aria-hidden="true"/>}
              </span>
              <span className="admin-slide-info">
                <span className="admin-product-name">{piece.name}</span>
                <span className="admin-sub">{piece.colorName}، سایز {piece.size}</span>
                <span className="admin-sub">قیمت: {formatToman(piece.price)}
                  {piece.ownSaleWins ? '؛ تخفیف خود محصول بیشتر است' : '؛ با تخفیف: ' + formatToman(piece.offerPrice)}</span>
              </span>
            </li>)}
          </ul>}
      </div>
    </section>}
  </div>;
}
