import type { Rarity } from '@/lib/contracts';

/** Original gradients; reflects pointer coordinates supplied by Card3D. */
export function CardHolographicEffect({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`fc-card-effects fc-card-effects-${rarity}`} aria-hidden="true">
      {rarity >= 2 && <span className="fc-card-shine" />}
      {rarity >= 3 && <span className="fc-card-foil" />}
      <span className="fc-card-glare" />
    </span>
  );
}
