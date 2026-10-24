'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { ArrowRight, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Card } from '@/lib/contracts';
import { useGame } from '../game-context';
import { CardDisplay } from './CardDisplay';
import { CARD_RARITY_STYLES } from './CardRarityFrame';

export interface CardInspectionProps {
  card: Card;
  close: () => void;
}

/** Full-screen inspection is separate from game mutations and the card catalogue. */
export function CardInspection({ card, close }: CardInspectionProps) {
  const { state } = useGame();
  const [flipped, setFlipped] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  const rarity = state.config.rarities[card.rarity];
  const series = state.series.find(item => item.id === card.seriesId);
  const inventory = state.inventory.find(item => item.cardId === card.id);
  const reduced = !!state.currentUser?.preferences.reducedMotion;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], [tabindex="0"]',
      )).filter(element => !element.closest('[inert]'));
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  function flip() {
    setFlipped(value => !value);
  }

  useEffect(() => {
    if (flipped) backRef.current?.focus({ preventScroll: true });
    else if (dialogRef.current?.contains(document.activeElement)) {
      frontRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    }
  }, [flipped]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fc-card-inspection"
      data-motion-reduced={reduced}
      role="dialog"
      aria-modal="true"
      aria-label={`Inspection de ${card.name}`}
      tabIndex={-1}
      ref={dialogRef}
      onClick={event => { if (event.target === event.currentTarget) close(); }}
      style={{ '--fc-inspection-rarity': CARD_RARITY_STYLES[card.rarity].color } as CSSProperties}
    >
      <button type="button" className="fc-inspection-close" onClick={close} aria-label="Fermer l’inspection"><X size={23} /></button>
      <div className="fc-inspection-stage">
        <div className="fc-inspection-turn" data-flipped={flipped}>
          <div className="fc-inspection-front" aria-hidden={flipped} inert={flipped} ref={frontRef}>
            <CardDisplay card={card} onClick={flip} reducedMotion={reduced} className="fc-inspection-card" />
          </div>
          <div className="fc-inspection-back" aria-hidden={!flipped} inert={!flipped}>
            <button type="button" className="fc-inspection-back-body" onClick={flip} ref={backRef} aria-label={`Retourner ${card.name} vers l’illustration`}>
              <span className="fc-inspection-meta"><b>{rarity.name}</b><span>#{String(card.number).padStart(3, '0')}/{state.cards.length}</span></span>
              <strong className="fc-inspection-name">{card.name}</strong>
              <span className="fc-inspection-series">{series?.name}</span>
              <span className="fc-inspection-stat-grid">
                <span>POINTS<b>{card.collectionPoints}</b></span>
                <span>RECYCLAGE<b>{card.recycleValue} Éclats</b></span>
                <span>INVENTAIRE<b>{inventory?.quantity || 0} exemplaire(s)</b></span>
              </span>
              <span className="fc-inspection-description">{card.description}</span>
              <RotateCcw className="fc-inspection-return-icon" size={20} />
            </button>
            <Link href={`/wiki/${card.id}`} className="fc-inspection-detail-link" onClick={close}>Voir la fiche de la carte <ArrowRight size={14} /></Link>
          </div>
        </div>
        <p className="fc-inspection-hint">Survolez la carte pour l’incliner · Touchez-la pour la retourner</p>
      </div>
    </div>,
    document.body,
  );
}
