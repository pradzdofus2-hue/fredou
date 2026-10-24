'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Card } from '@/lib/contracts';
import { useGame } from '../game-context';
import { Card3D } from './Card3D';
import { CardHolographicEffect } from './CardHolographicEffect';
import { CARD_RARITY_STYLES, CardRarityFrame } from './CardRarityFrame';
import './cards.css';

export interface CardDisplayProps {
  card: Card;
  muted?: boolean;
  onClick?: () => void;
  badge?: string;
  /** undefined links to the card; null renders a non-interactive face. */
  href?: string | null;
  className?: string;
  reducedMotion?: boolean;
  tilt?: boolean;
}

export function CardDisplay({
  card,
  muted = false,
  onClick,
  badge,
  href,
  className = '',
  reducedMotion = false,
  tilt = true,
}: CardDisplayProps) {
  const { state } = useGame();
  const rarity = state.config.rarities[card.rarity];
  const appearance = CARD_RARITY_STYLES[card.rarity];
  const inventory = state.inventory.find(item => item.cardId === card.id);
  const series = state.series.find(item => item.id === card.seriesId);
  const motionDisabled = reducedMotion || !!state.currentUser?.preferences.reducedMotion;
  const missing = muted && !inventory;
  const label = missing
    ? `Carte numéro ${card.number}, ${rarity.name}, à découvrir`
    : `${card.name}, ${rarity.name}, ${inventory?.quantity || 0} exemplaire${inventory?.quantity === 1 ? '' : 's'}`;
  const style = {
    '--rarity': appearance.color,
    '--fc-rarity-color': appearance.color,
    '--fc-rarity-background': appearance.background,
  } as CSSProperties;
  const classes = `collection-card fc-card fc-card-rarity-${card.rarity} ${missing ? 'card-missing fc-card-missing' : ''} ${className}`.trim();

  const content = missing ? (
    <>
      <span className="fc-card-missing-symbol" aria-hidden="true">?</span>
      <span className="fc-card-missing-number">#{String(card.number).padStart(3, '0')}</span>
      <span className="fc-card-missing-rarity"><i />{rarity.name}</span>
      <span className="fc-card-missing-label">À DÉCOUVRIR</span>
    </>
  ) : (
    <>
      <CardRarityFrame rarity={card.rarity} />
      <span className="fc-card-top card-caption">
        <strong className="fc-card-name" title={card.name}>{card.name}</strong>
        <span className="fc-card-rarity-badge" title={rarity.name}>{appearance.letter}</span>
      </span>
      <span className="fc-card-art card-art">
        <img src={card.image} alt={`Illustration de ${card.name}`} loading="lazy" decoding="async" draggable={false} />
        <span className="fc-card-art-shade" />
        <span className="fc-card-number card-number">#{String(card.number).padStart(3, '0')}/{state.cards.length}</span>
        {inventory?.favorite && <Heart className="fc-card-favorite card-heart" size={14} fill="currentColor" aria-label="Carte favorite" />}
        {badge && <span className="fc-card-obtained-badge card-badge">{badge}</span>}
      </span>
      <span className="fc-card-series" title={series?.name}>{series?.name}</span>
      <span className="fc-card-stats card-caption-bottom">
        <span title="Points de collection">PTS <b>{card.collectionPoints}</b></span>
        <span title="Valeur de recyclage en Éclats">ÉCL <b>{card.recycleValue}</b></span>
        <span className="owned-count" title="Exemplaires dans votre inventaire">EX <b>{inventory?.quantity || 0}</b></span>
      </span>
      <CardHolographicEffect rarity={card.rarity} />
    </>
  );

  return (
    <Card3D disabled={motionDisabled || missing || !tilt}>
      {bindings => {
        const props = {
          ...bindings,
          className: classes,
          style,
          'aria-label': label,
          'data-rarity': rarity.name,
          'data-card-id': card.id,
          'data-motion-reduced': motionDisabled,
          'data-tilt-disabled': !tilt || missing,
        };
        if (onClick) return <button type="button" {...props} onClick={onClick}>{content}</button>;
        if (href === null) return <div {...props}>{content}</div>;
        return <Link {...props} href={href || `/wiki/${card.id}`}>{content}</Link>;
      }}
    </Card3D>
  );
}
