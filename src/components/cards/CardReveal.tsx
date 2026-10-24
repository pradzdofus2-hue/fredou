'use client';

import { Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Card } from '@/lib/contracts';
import { useGame } from '../game-context';
import { CardDisplay } from './CardDisplay';
import { CARD_RARITY_STYLES } from './CardRarityFrame';

export interface CardRevealProps {
  card: Card;
  revealed: boolean;
  onReveal: () => void;
  index?: number;
  badge?: string;
  reducedMotion?: boolean;
  className?: string;
}

/** Presentation only: the parent owns reveal order and already-resolved rewards. */
export function CardReveal({
  card,
  revealed,
  onReveal,
  index = 0,
  badge,
  reducedMotion = false,
  className = '',
}: CardRevealProps) {
  const { state } = useGame();
  const reduced = reducedMotion || !!state.currentUser?.preferences.reducedMotion;
  const rarity = state.config.rarities[card.rarity];

  return (
    <div
      className={`fc-card-reveal ${className}`.trim()}
      data-revealed={revealed}
      data-motion-reduced={reduced}
      data-rarity-level={card.rarity}
      style={{ '--fc-rarity-color': CARD_RARITY_STYLES[card.rarity].color } as CSSProperties}
    >
      <div className="fc-card-flip">
        <div className="fc-card-reveal-back" aria-hidden={revealed}>
          <button
            className="fc-card-reveal-trigger card-back"
            type="button"
            onClick={onReveal}
            disabled={revealed}
            tabIndex={revealed ? -1 : 0}
            aria-label={`Révéler la carte ${index + 1}`}
          >
            <span className="fc-card-back-corner fc-card-back-corner-tl" />
            <span className="fc-card-back-corner fc-card-back-corner-tr" />
            <span className="fc-card-back-corner fc-card-back-corner-bl" />
            <span className="fc-card-back-corner fc-card-back-corner-br" />
            <span className="fc-card-back-medallion"><img src="/branding/krosmoria-logo.svg" alt="" draggable={false} /></span>
            <span className="fc-card-back-brand">KROSMORIA</span>
            <span className="fc-card-back-caption">COLLECTION</span>
            <span className="fc-card-back-hint"><Sparkles size={12} /> RÉVÉLER</span>
          </button>
        </div>
        <div className="fc-card-reveal-front" aria-hidden={!revealed}>
          <CardDisplay card={card} badge={badge} href={null} reducedMotion={reduced} tilt={false} />
        </div>
      </div>
      {revealed && card.rarity >= 3 && <span className="fc-card-reveal-light" aria-hidden="true" />}
      <span className="fc-card-sr-only" role="status">{revealed ? `${card.name}, ${rarity.name}${badge ? `, ${badge}` : ''}` : ''}</span>
    </div>
  );
}
