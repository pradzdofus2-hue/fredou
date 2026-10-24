/** Shared transport contracts. No server modules or secrets are imported here. */
export type Rarity = 0 | 1 | 2 | 3 | 4 | 5;
export type ISODate = string;
export type EntityId = string;

export interface Series { id: EntityId; name: string; description: string; color: string; }
export interface Card {
  id: EntityId; number: number; name: string; rarity: Rarity; seriesId: EntityId;
  description: string; image: string; recycleValue: number; collectionPoints: number;
}
export interface PublicUser {
  id: EntityId; username: string; avatar: string | null; joinedAt: ISODate;
  uniqueCards: number; collectionPoints: number; mythicCards: number;
  completedAlbums: number; achievementCount: number; completion: number;
}
export interface CurrentUser extends PublicUser {
  balance: number; role: 'player' | 'admin'; mode: 'development' | 'discord';
  preferences: { reducedMotion: boolean }; referralCode: string; referredBy: EntityId | null;
}
export interface InventoryItem {
  cardId: EntityId; quantity: number; favorite: boolean; firstObtainedAt: ISODate; lastObtainedAt: ISODate;
}
export type BoosterKind = 'free' | 'daily' | 'premium' | 'special' | 'event';
export interface Booster {
  id: EntityId; name: string; description: string; kind: BoosterKind; price: number;
  color: string; guarantee: Rarity; weights: number[]; pityLimit: number;
  cooldownSeconds: number; eventId: EntityId | null; seriesId: EntityId | null;
  available: number; nextAvailableAt: ISODate | null; pityCount: number; active: boolean;
}
export interface DrawnCard { cardId: EntityId; isNew: boolean; quantityBefore: number; }
export interface Opening {
  id: EntityId; boosterId: EntityId; createdAt: ISODate; cards: DrawnCard[];
  shardsReward: number; pityTriggered: boolean;
}
export interface LedgerEntry {
  id: EntityId; amount: number; balanceAfter: number; reason: string; createdAt: ISODate; referenceId: EntityId | null;
}
export interface Listing {
  id: EntityId; sellerId: EntityId; cardId: EntityId; quantity: number; price: number;
  status: 'active' | 'sold' | 'cancelled'; buyerId: EntityId | null; createdAt: ISODate; completedAt: ISODate | null;
}
export interface PricePoint { cardId: EntityId; unitPrice: number; quantity: number; soldAt: ISODate; }
export interface TradeItem { cardId: EntityId; quantity: number; }
export interface Trade {
  id: EntityId; senderId: EntityId; recipientId: EntityId; offered: TradeItem[]; requested: TradeItem[];
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'; createdAt: ISODate; resolvedAt: ISODate | null;
}
export interface Achievement {
  id: EntityId; name: string; description: string; icon: string; target: number;
  progress: number; reward: number; unlockedAt: ISODate | null;
}
export interface GameEvent {
  id: EntityId; name: string; description: string; startsAt: ISODate; endsAt: ISODate;
  active: boolean; color: string; reward: number;
}
export interface NewsItem { id: EntityId; title: string; body: string; kind: 'update' | 'event' | 'news'; publishedAt: ISODate; }
export type RankingMetric = 'uniqueCards' | 'collectionPoints' | 'mythicCards' | 'completedAlbums' | 'achievementCount' | 'completion';
export interface RankingEntry { userId: EntityId; rank: number; value: number; }
export type Rankings = Record<RankingMetric, RankingEntry[]>;
export interface Acquisition {
  id: EntityId; cardId: EntityId; quantity: number; source: string; createdAt: ISODate; referenceId: EntityId | null;
}
export interface Activity { id: EntityId; userId: EntityId; kind: string; message: string; createdAt: ISODate; }
export interface GameConfig {
  rarities: { id: Rarity; name: string; color: string; recycleValue: number; collectionPoints: number }[];
  cardsPerBooster: number; maxTradeItems: number; maxTradeQuantity: number; maxTradeValueRatio: number;
  referralReward: number; referralRequiredOpenings: number;
}
export interface StateResponse {
  version: '1'; serverTime: ISODate; mode: 'development' | 'discord'; discordConfigured: boolean;
  currentUser: CurrentUser | null; users: PublicUser[]; cards: Card[]; series: Series[];
  inventory: InventoryItem[]; boosters: Booster[]; openings: Opening[]; ledger: LedgerEntry[];
  listings: Listing[]; trades: Trade[]; achievements: Achievement[]; events: GameEvent[];
  news: NewsItem[]; rankings: Rankings; priceHistory: PricePoint[]; acquisitions: Acquisition[];
  activities: Activity[]; config: GameConfig;
}

/** Mutations require an Idempotency-Key UUID header; replay must retain body and key. */
export type Action =
  | { type: 'login-dev'; userId: EntityId }
  | { type: 'logout' }
  | { type: 'open'; boosterId: EntityId }
  | { type: 'buy-booster'; boosterId: EntityId; quantity: number }
  | { type: 'recycle'; cardId?: EntityId }
  | { type: 'favorite'; cardId: EntityId }
  | { type: 'listing-create'; cardId: EntityId; quantity: number; price: number }
  | { type: 'listing-buy'; listingId: EntityId }
  | { type: 'listing-cancel'; listingId: EntityId }
  | { type: 'trade-create'; recipientId: EntityId; offered: TradeItem[]; requested: TradeItem[] }
  | { type: 'trade-respond'; tradeId: EntityId; decision: 'accept' | 'reject' | 'cancel' }
  | { type: 'preferences'; reducedMotion: boolean }
  | { type: 'event-save'; id?: EntityId; name: string; description: string; startsAt: ISODate; endsAt: ISODate; active: boolean; color: string; reward: number }
  | { type: 'account-delete'; confirmation: string }
  | { type: 'referral'; code: string };
export interface ActionResult {
  type: Action['type']; message: string; opening?: Opening; amount?: number; quantity?: number; entityId?: EntityId;
}
export interface ActionResponse { state: StateResponse; result: ActionResult; }
export type ErrorCode = 'VALIDATION_ERROR' | 'AUTH_REQUIRED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INSUFFICIENT_FUNDS' | 'UNAVAILABLE' | 'IDEMPOTENCY_CONFLICT' | 'RATE_LIMITED' | 'OAUTH_UNAVAILABLE' | 'INTERNAL_ERROR';
export interface ErrorResponse { error: { code: ErrorCode; message: string; fields?: Record<string, string[]> }; }
