import 'server-only';
import type { PoolClient } from 'pg';
import type { StateResponse, PublicUser, CurrentUser, Rankings, RankingMetric, Booster, Achievement, Opening, Trade } from '../lib/contracts';
import { pgTransaction } from './postgres';
import { HIDDEN_DUPLICATE_CARD_IDS } from './card-visibility';
import { GAME_CONFIG, discordConfigured } from './config';

const metrics:RankingMetric[]=['uniqueCards','collectionPoints','mythicCards','completedAlbums','achievementCount','completion'];
type UserRow={id:string;username:string;avatar:string|null;created_at:string;balance:number;role:'player'|'admin';mode:'discord'|'development';reduced_motion:number;referral_code:string;referred_by:string|null};
type BoosterRow={id:string;name:string;description:string;kind:Booster['kind'];price:number;color:string;guarantee:Booster['guarantee'];weights:string;pity_limit:number;cooldown_seconds:number;event_id:string|null;series_id:string|null;capacity:number};
function parse<T>(value:string):T{return JSON.parse(value) as T;}
function reserve(b:BoosterRow,r:{available:number;last_refill:string;pity_count:number}|undefined,time:number){
 if(!r)return {available:0,nextAvailableAt:null as string|null,pityCount:0};
 let available=r.available,at:string|null=null;
 if(b.kind==='daily'){
  const day=new Date(time).toISOString().slice(0,10);
  if(day>r.last_refill.slice(0,10))available=1;
  if(!available)at=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString();
 }else if(b.kind==='free'&&b.cooldown_seconds>0){
  const interval=b.cooldown_seconds*1000,elapsed=Math.max(0,Math.floor((time-Date.parse(r.last_refill))/interval));
  available=Math.min(b.capacity,r.available+elapsed);
  const tick=available===b.capacity?time:Date.parse(r.last_refill)+elapsed*interval;
  if(available<b.capacity)at=new Date(tick+interval).toISOString();
 }
 return {available,nextAvailableAt:at,pityCount:r.pity_count};
}
export async function pgState(userId:string|null):Promise<StateResponse>{
 return pgTransaction(async(db:PoolClient)=>{
  const q=async <T extends import('pg').QueryResultRow>(sql:string,args:unknown[]=[]) => (await db.query<T>(sql,args)).rows;
  const count=async(sql:string,args:unknown[]=[])=>Number((await q<{n:string}>(sql,args))[0]?.n||0);
  const userRows=await q<UserRow>('SELECT * FROM users ORDER BY created_at,id');
  const cards=await q<StateResponse['cards'][number]>('SELECT id,number,name,rarity,series_id AS "seriesId",description,image,recycle_value AS "recycleValue",collection_points AS "collectionPoints" FROM cards WHERE NOT(id=ANY($1::text[])) ORDER BY number LIMIT 10000',[Array.from(HIDDEN_DUPLICATE_CARD_IDS)]);
  const series=await q<StateResponse['series'][number]>('SELECT id,name,description,color FROM series ORDER BY id LIMIT 500');
  const total=cards.length;
  const userStats=await q<{user_id:string;unique_cards:number;points:string;mythic:string}>(
   'SELECT i.user_id,COUNT(*)::integer AS unique_cards,COALESCE(SUM(c.collection_points),0)::text AS points,COALESCE(SUM(CASE WHEN c.rarity=5 THEN i.quantity ELSE 0 END),0)::text AS mythic FROM inventory i JOIN cards c ON c.id=i.card_id WHERE i.quantity>0 GROUP BY i.user_id');
  const stats=new Map(userStats.map(x=>[x.user_id,x]));
  const achievementsCount=await q<{user_id:string;n:number}>('SELECT user_id,COUNT(*)::integer n FROM user_achievements GROUP BY user_id');
  const achMap=new Map(achievementsCount.map(x=>[x.user_id,x.n]));
  const seriesTotals=await q<{series_id:string;n:number}>('SELECT series_id,COUNT(*)::integer n FROM cards WHERE NOT(id=ANY($1::text[])) GROUP BY series_id',[Array.from(HIDDEN_DUPLICATE_CARD_IDS)]);
  const ownedBySeries=await q<{user_id:string;series_id:string;n:number}>('SELECT i.user_id,c.series_id,COUNT(*)::integer n FROM inventory i JOIN cards c ON c.id=i.card_id WHERE i.quantity>0 AND NOT(c.id=ANY($1::text[])) GROUP BY i.user_id,c.series_id',[Array.from(HIDDEN_DUPLICATE_CARD_IDS)]);
  const albums=new Map<string,number>();
  for(const x of ownedBySeries)if(seriesTotals.find(t=>t.series_id===x.series_id)?.n===x.n)albums.set(x.user_id,(albums.get(x.user_id)||0)+1);
  const users:PublicUser[]=userRows.map(x=>{
   const stat=stats.get(x.id);
   const uniqueCards=stat?.unique_cards||0;
   return {id:x.id,username:x.username,avatar:x.avatar,joinedAt:x.created_at,uniqueCards,collectionPoints:Number(stat?.points||0),mythicCards:Number(stat?.mythic||0),completedAlbums:albums.get(x.id)||0,achievementCount:achMap.get(x.id)||0,completion:total?Math.round(uniqueCards/total*10000)/100:0};
  });
  const currentRow=userRows.find(x=>x.id===userId);
  const currentUser:CurrentUser|null=currentRow?{...users.find(x=>x.id===currentRow.id)!,balance:currentRow.balance,role:currentRow.role,mode:currentRow.mode,preferences:{reducedMotion:!!currentRow.reduced_motion},referralCode:currentRow.referral_code,referredBy:currentRow.referred_by}:null;
  const rankings={} as Rankings;
  for(const metric of metrics)rankings[metric]=[...users].sort((a,b)=>b[metric]-a[metric]||a.joinedAt.localeCompare(b.joinedAt)||a.id.localeCompare(b.id)).map((u,i)=>({userId:u.id,rank:i+1,value:u[metric]}));
  const inventory=currentUser?(await q<StateResponse['inventory'][number]>('SELECT card_id AS "cardId",quantity,favorite,first_obtained_at AS "firstObtainedAt",last_obtained_at AS "lastObtainedAt" FROM inventory WHERE user_id=$1 AND quantity>0 ORDER BY last_obtained_at DESC',[userId])).map(x=>({...x,favorite:!!x.favorite})):[];
  const openings=currentUser?(await q<{id:string;boosterId:string;createdAt:string;cards:string;shardsReward:number;pityTriggered:number}>('SELECT id,booster_id AS "boosterId",created_at AS "createdAt",cards,shards_reward AS "shardsReward",pity_triggered AS "pityTriggered" FROM openings WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',[userId])).map(x=>({...x,cards:parse<Opening['cards']>(x.cards),pityTriggered:!!x.pityTriggered})):[];
  const ledger=currentUser?await q<StateResponse['ledger'][number]>('SELECT id,amount,balance_after AS "balanceAfter",reason,created_at AS "createdAt",reference_id AS "referenceId" FROM ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',[userId]):[];
  const listings=await q<StateResponse['listings'][number]>('SELECT id,COALESCE(seller_id,\'deleted\') AS "sellerId",card_id AS "cardId",quantity,price,status,buyer_id AS "buyerId",created_at AS "createdAt",completed_at AS "completedAt" FROM listings WHERE status=\'active\' OR seller_id=$1 OR buyer_id=$1 ORDER BY (status=\'active\') DESC,created_at DESC,id DESC LIMIT 500',[userId]);
  const trades=currentUser?(await q<{id:string;senderId:string;recipientId:string;offered:string;requested:string;status:Trade['status'];createdAt:string;resolvedAt:string|null}>('SELECT id,sender_id AS "senderId",recipient_id AS "recipientId",offered,requested,status,created_at AS "createdAt",resolved_at AS "resolvedAt" FROM trades WHERE sender_id=$1 OR recipient_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200',[userId])).map(x=>({...x,offered:parse<Trade['offered']>(x.offered),requested:parse<Trade['requested']>(x.requested)})):[];
  const eventRows=await q<StateResponse['events'][number]>('SELECT id,name,description,starts_at AS "startsAt",ends_at AS "endsAt",active,color,reward FROM events ORDER BY starts_at DESC LIMIT 100');
  const events=eventRows.map(x=>({...x,active:!!x.active}));
  const boosterRows=await q<BoosterRow>('SELECT * FROM boosters ORDER BY id');
  const userRes=currentUser?await q<{booster_id:string;available:number;last_refill:string;pity_count:number}>('SELECT * FROM user_boosters WHERE user_id=$1',[userId]):[];
  const boosters:Booster[]=boosterRows.map(b=>{
   const r=reserve(b,userRes.find(x=>x.booster_id===b.id),Date.now());
   const event=events.find(e=>e.id===b.event_id),time=new Date().toISOString();
   return {id:b.id,name:b.name,description:b.description,kind:b.kind,price:b.price,color:b.color,guarantee:b.guarantee,weights:parse<number[]>(b.weights),pityLimit:b.pity_limit,cooldownSeconds:b.cooldown_seconds,eventId:b.event_id,seriesId:b.series_id,...r,active:!b.event_id||!!(event?.active&&event.startsAt<=time&&event.endsAt>time)};
  });
  const achievementRows=await q<{id:string;name:string;description:string;icon:string;target:number;reward:number}>('SELECT * FROM achievements ORDER BY id');
  const unlocked=currentUser?await q<{achievement_id:string;unlocked_at:string}>('SELECT achievement_id,unlocked_at FROM user_achievements WHERE user_id=$1',[userId]):[];
  const progress:Record<string,number>={};
  if(currentUser){
   const userArgs=[userId];
   const openingCount=await count('SELECT COUNT(*)::text n FROM openings WHERE user_id=$1',userArgs);
   progress['first-opening']=progress['ten-openings']=openingCount;
   progress['ten-unique']=progress['fifty-unique']=currentUser.uniqueCards;
   progress['first-album']=currentUser.completedAlbums;
   progress['first-legendary']=await count('SELECT COUNT(*)::text n FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=$1 AND c.rarity=4',userArgs);
   progress['first-mythic']=await count('SELECT COUNT(*)::text n FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=$1 AND c.rarity=5',userArgs);
   progress['first-recycle']=await count("SELECT COUNT(*)::text n FROM activities WHERE user_id=$1 AND kind='recycle'",userArgs);
   progress['first-transaction']=await count("SELECT COUNT(*)::text n FROM activities WHERE user_id=$1 AND kind='market'",userArgs);
  }
  const achievements:Achievement[]=achievementRows.map(a=>({...a,progress:Math.min(a.target,progress[a.id]||0),unlockedAt:unlocked.find(x=>x.achievement_id===a.id)?.unlocked_at||null}));
  return {version:'1',serverTime:new Date().toISOString(),mode:'discord',discordConfigured:discordConfigured(),currentUser,users,cards,series,inventory,boosters,openings,ledger,listings,trades,achievements,events,
   news:await q<StateResponse['news'][number]>('SELECT id,title,body,kind,published_at AS "publishedAt" FROM news ORDER BY published_at DESC LIMIT 100'),
   rankings,priceHistory:await q<StateResponse['priceHistory'][number]>('SELECT card_id AS "cardId",unit_price AS "unitPrice",quantity,sold_at AS "soldAt" FROM price_history ORDER BY sold_at DESC LIMIT 500'),
   acquisitions:currentUser?await q<StateResponse['acquisitions'][number]>('SELECT id,card_id AS "cardId",quantity,source,created_at AS "createdAt",reference_id AS "referenceId" FROM acquisitions WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 500',[userId]):[],
   activities:await q<StateResponse['activities'][number]>('SELECT id,user_id AS "userId",kind,message,created_at AS "createdAt" FROM activities ORDER BY created_at DESC,id DESC LIMIT 100'),config:GAME_CONFIG};
 });
}
