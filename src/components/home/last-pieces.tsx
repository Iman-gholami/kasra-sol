import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { LastPieceCard } from '@/components/home/last-piece-card';
import { LastPieceStamp } from '@/components/home/last-piece-stamp';
import { LastPiecesArrows } from '@/components/home/last-pieces-arrows';
import type { LastPieces as LastPiecesData } from '@/lib/last-pieces';

const TRACK_ID = 'last-pieces-track';

/** The home page's «آخرین دونه‌ها», laid out like the owner's reference in Kasra red: a red band edge to edge, the
 * stamp and the title, «مشاهده همه» (every piece, /last-pieces), and one white card per colour and size with one unit
 * left, scrolling sideways. Server-rendered; only the arrows hydrate. */
export function LastPieces({ rail }: { rail: LastPiecesData }) {
  return <section className="container section-block last-pieces" aria-labelledby="last-title">
    <div className="last-pieces-band">
      <div className="last-pieces-head">
        <div className="last-pieces-title">
          <LastPieceStamp/>
          <h2 id="last-title">آخرین دونه‌ها</h2>
        </div>
        <Link className="last-pieces-all" href="/last-pieces">مشاهده همه <ChevronLeft size={18} aria-hidden="true"/></Link>
      </div>
      <div className="last-pieces-body">
        <div className="last-pieces-track" id={TRACK_ID}>
          <ul className="last-pieces-list">
            {rail.items.map(piece => <li key={piece.key}><LastPieceCard piece={piece}/></li>)}
          </ul>
        </div>
        <LastPiecesArrows trackId={TRACK_ID}/>
      </div>
    </div>
  </section>;
}
