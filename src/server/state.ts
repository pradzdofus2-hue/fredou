import { HIDDEN_DUPLICATE_CARD_IDS, VISIBLE_CARDS_CONDITION } from './card-visibility';
import type { StateResponse, CurrentUser, PublicUser, Rankings, RankingMetric, InventoryItem, Opening, LedgerEntry, Listing, Trade, GameEvent, NewsItem, PricePoint, Acquisition, Activity, Card, Series } from '../lib/contracts';
import { all, getDb, now } from './database';
import { boosterState } from './game';
import { achievementProgress,userStatistics } from './achievements';
import { GAME_CONFIG,discordConfigured,isDevelopmentMode } from './config';
interface UserRow {id:string;username:string;avatar:string|null;created_at:string;balance:number;role:'admin'|'player';mode:'development'|'discord';reduced_motion:number;referral_code:string;referred_by:string|null;}
/** A deferred read transaction gives all DTO sections the same SQLite snapshot. */
export function getState(userId:string|null):StateResponse {
  const db=getDb();db.exec('BEGIN');
  try { const state=buildState(userId);db.exec('COMMIT');return state; }
  catch(error) { db.exec('ROLLBACK');throw error; }
}
function buildState(userId:string|null):StateResponse {
  const userRows=all<UserRow>('SELECT * FROM users ORDER BY created_at,id');
  const users:PublicUser[]=userRows.map(u=>({id:u.id,username:u.username,avatar:u.avatar,joinedAt:u.created_at,...userStatistics(u.id)}));
  const currentRow=userId?userRows.find(u=>u.id===userId):undefined;
  const currentUser:CurrentUser|null=currentRow?{...users.find(u=>u.id===currentRow.id)!,balance:currentRow.balance,role:currentRow.role,mode:currentRow.mode,preferences:{reducedMotion:!!currentRow.reduced_motion},referralCode:currentRow.referral_code,referredBy:currentRow.referred_by}:null;
  const rankings={} as Rankings;
  for(const metric of ['uniqueCards','collectionPoints','mythicCards','completedAlbums','achievementCount','completion'] as RankingMetric[]) {
    const sorted=[...users].sort((a,b)=>b[metric]-a[metric]||a.joinedAt.localeCompare(b.joinedAt)||a.id.localeCompare(b.id));
    rankings[metric]=sorted.map((u,index)=>({userId:u.id,rank:index+1,value:u[metric]}));
  }
  const inventory=currentUser?all<InventoryItem>('SELECT card_id cardId,quantity,favorite,first_obtained_at firstObtainedAt,last_obtained_at lastObtainedAt FROM inventory WHERE user_id=? AND quantity>0 ORDER BY last_obtained_at DESC',userId!).map(i=>({...i,favorite:!!i.favorite})):[];
  const openings=currentUser?all<{id:string;boosterId:string;createdAt:string;cards:string;shardsReward:number;pityTriggered:number}>('SELECT id,booster_id boosterId,created_at createdAt,cards,shards_reward shardsReward,pity_triggered pityTriggered FROM openings WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200',userId!).map(o=>({...o,cards:JSON.parse(o.cards),pityTriggered:!!o.pityTriggered})) as Opening[]:[];
  const ledger=currentUser?all<LedgerEntry>('SELECT id,amount,balance_after balanceAfter,reason,created_at createdAt,reference_id referenceId FROM ledger WHERE user_id=? ORDER BY rowid DESC LIMIT 200',userId!):[];
  const listings=all<Listing>(`SELECT id,COALESCE(seller_id,'deleted') sellerId,card_id cardId,quantity,price,status,buyer_id buyerId,created_at createdAt,completed_at completedAt FROM listings WHERE status='active' ${currentUser?'OR seller_id=? OR buyer_id=?':''} ORDER BY (status='active') DESC,rowid DESC LIMIT 500`,...(currentUser?[currentUser.id,currentUser.id]:[]));
  const trades=currentUser?all<{id:string;senderId:string;recipientId:string;offered:string;requested:string;status:Trade['status'];createdAt:string;resolvedAt:string|null}>('SELECT id,sender_id senderId,recipient_id recipientId,offered,requested,status,created_at createdAt,resolved_at resolvedAt FROM trades WHERE sender_id=? OR recipient_id=? ORDER BY rowid DESC LIMIT 200',userId!,userId!).map(t=>({...t,offered:JSON.parse(t.offered),requested:JSON.parse(t.requested)})) as Trade[]:[];
  const cards=all<Card>(`SELECT id,number,name,rarity,series_id seriesId,description,image,recycle_value recycleValue,collection_points collectionPoints FROM cards WHERE ${VISIBLE_CARDS_CONDITION} ORDER BY number LIMIT 10000`, ...HIDDEN_DUPLICATE_CARD_IDS);
  const events=all<GameEvent>('SELECT id,name,description,starts_at startsAt,ends_at endsAt,active,color,reward FROM events ORDER BY starts_at DESC LIMIT 100').map(e=>({...e,active:!!e.active}));
  return {version:'1',serverTime:now(),mode:isDevelopmentMode()?'development':'discord',discordConfigured:discordConfigured(),currentUser,users,cards,series:all<Series>('SELECT * FROM series ORDER BY rowid LIMIT 500'),inventory,boosters:boosterState(currentUser?.id||null),openings,ledger,listings,trades,achievements:achievementProgress(currentUser?.id||null),events,
    news:all<NewsItem>('SELECT id,title,body,kind,published_at publishedAt FROM news ORDER BY published_at DESC LIMIT 100'),rankings,
    priceHistory:all<PricePoint>('SELECT card_id cardId,unit_price unitPrice,quantity,sold_at soldAt FROM price_history ORDER BY sold_at DESC LIMIT 500'),
    acquisitions:currentUser?all<Acquisition>('SELECT id,card_id cardId,quantity,source,created_at createdAt,reference_id referenceId FROM acquisitions WHERE user_id=? ORDER BY rowid DESC LIMIT 500',userId!):[],
    activities:all<Activity>('SELECT id,user_id userId,kind,message,created_at createdAt FROM activities ORDER BY rowid DESC LIMIT 100'),config:GAME_CONFIG};
}
