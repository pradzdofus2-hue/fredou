import type { BoosterKind, GameConfig, Rarity } from '../lib/contracts';

export const GAME_CONFIG: GameConfig = {
  rarities: [
    { id: 0, name: 'Commune', color: '#aab5cb', recycleValue: 1, collectionPoints: 1 },
    { id: 1, name: 'Peu commune', color: '#55d5a1', recycleValue: 1, collectionPoints: 3 },
    { id: 2, name: 'Rare', color: '#5d9bff', recycleValue: 3, collectionPoints: 10 },
    { id: 3, name: 'Épique', color: '#b27bff', recycleValue: 10, collectionPoints: 30 },
    { id: 4, name: 'Légendaire', color: '#ffcb65', recycleValue: 40, collectionPoints: 100 },
    { id: 5, name: 'Mythique', color: '#fb719c', recycleValue: 150, collectionPoints: 350 },
  ],
  cardsPerBooster: 5, maxTradeItems: 20, maxTradeQuantity: 50, maxTradeValueRatio: 10,
  referralReward: 100, referralRequiredOpenings: 3,
};
export interface BoosterDefinition {
  id: string; name: string; description: string; kind: BoosterKind; price: number;
  color: string; guarantee: Rarity; weights: number[]; pityLimit: number;
  cooldownSeconds: number; eventId: string | null; seriesId: string | null; capacity: number;
}
export const BOOSTERS: BoosterDefinition[] = [
  { id: 'free', name: 'Éclat originel', description: 'Une recharge toutes les 4 heures, jusqu’à 3 réserves. Une Rare garantie.', kind: 'free', price: 0, color: '#a78bfa', guarantee: 2, weights: [5200, 2800, 1400, 480, 110, 10], pityLimit: 250, cooldownSeconds: 14400, eventId: null, seriesId: null, capacity: 3 },
  { id: 'daily', name: 'Rendez-vous astral', description: 'Votre rendez-vous quotidien : cinq cartes, un Épique garanti et 25 Éclats. Renouvelé à minuit UTC.', kind: 'daily', price: 0, color: '#5ddac1', guarantee: 3, weights: [4700, 2900, 1700, 550, 135, 15], pityLimit: 250, cooldownSeconds: 86400, eventId: null, seriesId: null, capacity: 1 },
  { id: 'premium', name: 'Prisme céleste', description: 'Un Épique garanti, une chance accrue de découvrir les plus rares.', kind: 'premium', price: 120, color: '#e4b769', guarantee: 3, weights: [3400, 3000, 2300, 1000, 270, 30], pityLimit: 100, cooldownSeconds: 0, eventId: null, seriesId: null, capacity: 0 },
  { id: 'special', name: 'Échos de la sylve', description: 'Cinq habitants de la Sylve des murmures, dont un Épique garanti.', kind: 'special', price: 150, color: '#74d69d', guarantee: 3, weights: [3500, 2700, 2400, 1100, 270, 30], pityLimit: 100, cooldownSeconds: 0, eventId: null, seriesId: 'sylve', capacity: 0 },
  { id: 'event', name: 'Convergence des astres', description: 'Édition événementielle. Un Épique garanti et une récompense de première ouverture.', kind: 'event', price: 180, color: '#f287a7', guarantee: 3, weights: [3000, 2800, 2500, 1300, 350, 50], pityLimit: 75, cooldownSeconds: 0, eventId: 'convergence', seriesId: 'aetherion', capacity: 0 },
];
export function validateConfig(): void {
  if (GAME_CONFIG.cardsPerBooster !== 5) throw new Error('Les boosters doivent contenir cinq cartes.');
  if (GAME_CONFIG.rarities.length!==6 || GAME_CONFIG.rarities.some((rarity,index)=>rarity.id!==index||!Number.isSafeInteger(rarity.recycleValue)||rarity.recycleValue<1||!Number.isSafeInteger(rarity.collectionPoints)||rarity.collectionPoints<1)) throw new Error('La configuration des raretés est invalide.');
  for (const booster of BOOSTERS) {
    if (booster.weights.length !== 6 || booster.weights.some(w => !Number.isInteger(w) || w <= 0) || booster.weights.reduce((a, b) => a + b, 0) !== 10000 || !Number.isSafeInteger(booster.pityLimit) || booster.pityLimit < 1 || !Number.isInteger(booster.guarantee) || booster.guarantee<0 || booster.guarantee>5) throw new Error(`Configuration de probabilités invalide : ${booster.id}`);
  }
}
export function isDevelopmentMode(): boolean {
  let local = false;
  try { local = ['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.APP_URL || 'http://127.0.0.1:3000').hostname); } catch { return false; }
  return local && (process.env.LOCAL_DEV_MODE === 'true' || (process.env.LOCAL_DEV_MODE === undefined && !process.env.DISCORD_CLIENT_ID));
}
export function discordConfigured(): boolean { return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET); }
