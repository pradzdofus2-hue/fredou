'use client';
import type { CSSProperties } from 'react';
import { useGame } from './game-context';
import { CARD_RARITY_STYLES } from './cards';
import './collection.css';
export interface RarityFiltersProps { value: string; onChange: (value: string) => void; className?: string; }
export function RarityFilters({ value, onChange, className = '' }: RarityFiltersProps) {
  const { state } = useGame();
  return <div className={`fc-rarity-filters ${className}`} role="group" aria-label="Filtrer par rareté">
    <button type="button" aria-pressed={value === ''} className={value === '' ? 'active' : ''} onClick={() => onChange('')}><span className="fc-rarity-filter-dot all" />Toutes</button>
    {state.config.rarities.map(rarity => <button type="button" key={rarity.id} aria-pressed={value === String(rarity.id)} className={value === String(rarity.id) ? 'active' : ''} onClick={() => onChange(String(rarity.id))} style={{ '--fc-filter-rarity': rarity.id === 0 ? '#bcb8c4' : CARD_RARITY_STYLES[rarity.id].color } as CSSProperties}><span className="fc-rarity-filter-dot" />{rarity.name}</button>)}
  </div>;
}
