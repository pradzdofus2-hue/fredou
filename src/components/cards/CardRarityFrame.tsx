import type { Rarity } from '@/lib/contracts';

export const CARD_RARITY_STYLES = [
  { letter: 'C', color: '#5a5662', background: '#34313b' },
  { letter: 'U', color: '#3fbf7f', background: '#1f3b2e' },
  { letter: 'R', color: '#4d9bff', background: '#1b2c4a' },
  { letter: 'E', color: '#b072ff', background: '#2e1c47' },
  { letter: 'L', color: '#f5c518', background: '#352908' },
  { letter: 'M', color: '#ff4d2e', background: '#14101c' },
] as const;

export function CardRarityFrame({ rarity }: { rarity: Rarity }) {
  return <span className={`fc-card-frame fc-card-frame-${rarity}`} aria-hidden="true" />;
}
