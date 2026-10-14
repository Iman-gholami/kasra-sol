import { formatNumber } from '@/lib/format';
import type { CartItem, Product } from '@/types/store';

/** Variant facts as labelled pairs. Separators are Persian commas, never a middle dot that can be
 * misread as the Persian zero next to digits; Latin sizes are bidi-isolated. */
export function LineDetails({ item, product, showQuantity = false }: { item: CartItem; product: Product; showQuantity?: boolean }) {
  const color = product.colors.find(entry => entry.id === item.colorId);
  return <p className="line-details">
    <span className="line-swatch" style={{ backgroundColor: color?.hex }} aria-hidden="true"/>
    <span>رنگ {color?.name ?? '—'}،</span>
    <span>سایز <span dir="ltr">{item.size}</span>{showQuantity ? '،' : ''}</span>
    {showQuantity && <span>تعداد {formatNumber(item.quantity)}</span>}
  </p>;
}
