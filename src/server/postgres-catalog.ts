import 'server-only';
import { pgRead } from './postgres';
import { HIDDEN_DUPLICATE_CARD_IDS } from './card-visibility';
import type { Card, Series } from '../lib/contracts';

export async function postgresCatalog(): Promise<{cards: Card[]; series: Series[]}> {
  const cards = await pgRead<Card>('SELECT id, number, name, rarity, series_id AS "seriesId", description, image, recycle_value AS "recycleValue", collection_points AS "collectionPoints" FROM cards WHERE NOT (id = ANY($1::text[])) ORDER BY number LIMIT 10000', [Array.from(HIDDEN_DUPLICATE_CARD_IDS)]);
  const series = await pgRead<Series>('SELECT id, name, description, color FROM series ORDER BY id LIMIT 500');
  return {cards, series};
}
