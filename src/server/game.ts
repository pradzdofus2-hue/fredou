import { randomInt } from 'node:crypto';
import type { ActionResult, Booster, Card, DrawnCard, Opening, Rarity } from '../lib/contracts';
import { all, getDb, id, now, one } from './database';
import { acquire, adjustBalance, logActivity } from './economy';
import { ensure } from './errors';
import { GAME_CONFIG } from './config';

interface BoosterRow { id:string;name:string;description:string;kind:Booster['kind'];price:number;color:string;guarantee:Rarity;weights:string;pity_limit:number;cooldown_seconds:number;event_id:string|null;series_id:string|null;capacity:number; }
interface Reserve { available:number;last_refill:string;pity_count:number; }
function effectiveReserve(b:BoosterRow,reserve:Reserve,date:number):{available:number;lastRefill:string;nextAvailableAt:string|null} {
  if (b.kind==='daily') {
    const today=new Date(date).toISOString().slice(0,10),lastDay=reserve.last_refill.slice(0,10);
    return {available:today>lastDay?1:reserve.available,lastRefill:today>lastDay?`${today}T00:00:00.000Z`:reserve.last_refill,nextAvailableAt:(today>lastDay?1:reserve.available)>0?null:new Date(Date.parse(`${today}T00:00:00.000Z`)+86400000).toISOString()};
  }
  if (b.kind==='free') {
    const period=b.cooldown_seconds*1000,elapsed=Math.max(0,Math.floor((date-Date.parse(reserve.last_refill))/period));
    const available=Math.min(b.capacity,reserve.available+elapsed);
    const tick=available===b.capacity?date:Date.parse(reserve.last_refill)+elapsed*period;
    return {available,lastRefill:new Date(tick).toISOString(),nextAvailableAt:available<b.capacity?new Date(tick+period).toISOString():null};
  }
  return {available:reserve.available,lastRefill:reserve.last_refill,nextAvailableAt:null};
}
export function boosterState(userId:string|null):Booster[] {
  return all<BoosterRow>('SELECT * FROM boosters ORDER BY rowid').map(b=>{
    const reserve=userId?one<Reserve>('SELECT * FROM user_boosters WHERE user_id=? AND booster_id=?',userId,b.id):undefined;
    const effective=reserve?effectiveReserve(b,reserve,Date.now()):{available:0,nextAvailableAt:null};
    const event=b.event_id?one<{active:number;starts_at:string;ends_at:string}>('SELECT active,starts_at,ends_at FROM events WHERE id=?',b.event_id):null;
    const date=now(),active=!b.event_id || Boolean(event?.active && event.starts_at<=date && event.ends_at>date);
    return {id:b.id,name:b.name,description:b.description,kind:b.kind,price:b.price,color:b.color,guarantee:b.guarantee,weights:JSON.parse(b.weights),pityLimit:b.pity_limit,cooldownSeconds:b.cooldown_seconds,eventId:b.event_id,seriesId:b.series_id,available:effective.available,nextAvailableAt:effective.nextAvailableAt,pityCount:reserve?.pity_count||0,active};
  });
}
function weightedRarity(weights:number[],minimum:Rarity):Rarity {
  const sum=weights.slice(minimum).reduce((a,b)=>a+b,0);
  ensure(Number.isSafeInteger(sum)&&sum>0,'INTERNAL_ERROR','Configuration de tirage invalide.',500);
  let roll=randomInt(sum);
  for (let rarity=minimum;rarity<6;rarity++) {roll-=weights[rarity];if(roll<0)return rarity as Rarity;}
  throw new Error('Distribution de tirage incohérente.');
}
export function openBooster(userId:string,boosterId:string):ActionResult {
  const booster=boosterState(userId).find(b=>b.id===boosterId);
  ensure(booster,'NOT_FOUND','Booster introuvable.',404);
  ensure(booster.active,'UNAVAILABLE','Cet événement est inactif.',409);
  ensure(booster.available>0,'UNAVAILABLE','Ce booster n’est pas disponible. Attendez son rechargement ou achetez-en en boutique.',409);
  const raw=one<BoosterRow>('SELECT * FROM boosters WHERE id=?',boosterId)!;
  const reserve=one<Reserve>('SELECT * FROM user_boosters WHERE user_id=? AND booster_id=?',userId,boosterId)!;
  const effective=effectiveReserve(raw,reserve,Date.now());
  const openingId=id(),date=now(),cards:DrawnCard[]=[];
  const candidates=all<{id:string;rarity:Rarity}>(`SELECT id,rarity FROM cards WHERE id <> 'card-70' ${booster.seriesId?'AND series_id=?':''}`, ...(booster.seriesId?[booster.seriesId]:[]));
  for(let rarity=0;rarity<6;rarity++)ensure(candidates.some(c=>c.rarity===rarity),'INTERNAL_ERROR','Une rareté ne possède aucune carte dans ce booster.',500);
  const pityTriggered=reserve.pity_count+1>=booster.pityLimit;
  let foundMythic=false;
  for(let slot=0;slot<GAME_CONFIG.cardsPerBooster;slot++) {
    const minimum:Rarity=slot===4?(pityTriggered?5:booster.guarantee):slot===3?1:0;
    const rarity=weightedRarity(booster.weights,minimum),pool=candidates.filter(c=>c.rarity===rarity),card=pool[randomInt(pool.length)];
    const quantityBefore=one<{quantity:number}>('SELECT quantity FROM inventory WHERE user_id=? AND card_id=?',userId,card.id)?.quantity||0;
    const discovered=one('SELECT 1 FROM acquisitions WHERE user_id=? AND card_id=? LIMIT 1',userId,card.id);
    cards.push({cardId:card.id,isNew:!discovered,quantityBefore});
    acquire(userId,card.id,1,`booster : ${booster.name}`,openingId);
    if(rarity===5)foundMythic=true;
  }
  getDb().prepare('UPDATE user_boosters SET available=?,last_refill=?,pity_count=? WHERE user_id=? AND booster_id=?').run(effective.available-1,effective.lastRefill,foundMythic?0:reserve.pity_count+1,userId,boosterId);
  let shardsReward=booster.kind==='daily'?25:5;
  if (booster.eventId && !one('SELECT 1 FROM event_rewards WHERE user_id=? AND event_id=?',userId,booster.eventId)) {
    shardsReward+=one<{reward:number}>('SELECT reward FROM events WHERE id=?',booster.eventId)!.reward;
    getDb().prepare('INSERT INTO event_rewards VALUES(?,?,?)').run(userId,booster.eventId,date);
  }
  const opening:Opening={id:openingId,boosterId,createdAt:date,cards,shardsReward,pityTriggered};
  getDb().prepare('INSERT INTO openings VALUES(?,?,?,?,?,?,?)').run(openingId,userId,boosterId,date,JSON.stringify(cards),shardsReward,pityTriggered?1:0);
  adjustBalance(userId,shardsReward,`Ouverture : ${booster.name}`,openingId);
  logActivity(userId,'opening',`${booster.name} : cinq cartes découvertes.`);
  return {type:'open',message:'Vos cinq cartes ont rejoint votre collection.',opening,amount:shardsReward};
}
export function buyBooster(userId:string,boosterId:string,quantity:number):ActionResult {
  const booster=boosterState(userId).find(b=>b.id===boosterId);
  ensure(booster,'NOT_FOUND','Booster introuvable.',404);
  ensure(booster.price>0&&booster.active,'UNAVAILABLE','Ce booster ne peut pas être acheté actuellement.',409);
  adjustBalance(userId,-booster.price*quantity,`Achat de ${quantity} booster(s) ${booster.name}`,boosterId);
  getDb().prepare('UPDATE user_boosters SET available=available+? WHERE user_id=? AND booster_id=?').run(quantity,userId,boosterId);
  logActivity(userId,'shop',`${quantity} booster(s) ${booster.name} acheté(s).`);
  return {type:'buy-booster',message:'Les boosters ont rejoint votre réserve.',quantity,amount:booster.price*quantity};
}
