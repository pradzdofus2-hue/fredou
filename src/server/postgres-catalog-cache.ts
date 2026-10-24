import type {PoolClient} from 'pg';
import type {Card,Series} from '../lib/contracts';
import {HIDDEN_DUPLICATE_CARD_IDS} from './card-visibility';

// Cache only public catalogue metadata, never sessions, inventory or player balances.
// Serverless instances may each hold a copy; the short TTL allows newly added cards to appear.
type Catalog={cards:Card[];series:Series[]};
const globalCache=globalThis as typeof globalThis & {fredouCatalogueCache?:{until:number;data:Catalog;};fredouCataloguePending?:Promise<Catalog>};
export async function sharedCatalogue(db:PoolClient):Promise<Catalog>{
 const cache=globalCache.fredouCatalogueCache;
 if(cache && cache.until>Date.now())return cache.data;
 if(globalCache.fredouCataloguePending)return globalCache.fredouCataloguePending;
 const pending=(async()=>{
  const [cards,series]=await Promise.all([
   db.query<Card>('SELECT id,number,name,rarity,series_id AS "seriesId",description,image,recycle_value AS "recycleValue",collection_points AS "collectionPoints" FROM cards WHERE NOT(id=ANY($1::text[])) ORDER BY number LIMIT 10000',[Array.from(HIDDEN_DUPLICATE_CARD_IDS)]),
   db.query<Series>('SELECT id,name,description,color FROM series ORDER BY id LIMIT 500')
  ]);
  const data={cards:cards.rows,series:series.rows};
  globalCache.fredouCatalogueCache={until:Date.now()+45_000,data};
  return data;
 })();
 globalCache.fredouCataloguePending=pending;
 try{return await pending;}finally{if(globalCache.fredouCataloguePending===pending)globalCache.fredouCataloguePending=undefined;}
}
