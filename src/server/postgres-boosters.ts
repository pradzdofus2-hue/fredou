import {awardPgAchievements} from './postgres-achievements';
import { awardPgReferral } from './postgres-referral-reward';
import { randomInt, randomUUID, createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { ActionResult, DrawnCard, Rarity } from '../lib/contracts';
import { HIDDEN_DUPLICATE_CARD_IDS } from './card-visibility';
import { GAME_CONFIG } from './config';
import { GameError, ensure } from './errors';
import { pgTransaction } from './postgres';

type BoosterRow={id:string;name:string;kind:string;price:number;guarantee:Rarity;weights:string;pity_limit:number;cooldown_seconds:number;event_id:string|null;series_id:string|null;capacity:number};
type Reserve={available:number;last_refill:string;pity_count:number};

function weighted(weights:number[],minimum:number):Rarity {
  const sum=weights.slice(minimum).reduce((a,b)=>a+b,0);
  ensure(Number.isSafeInteger(sum)&&sum>0,'INTERNAL_ERROR','Probabilités invalides.',500);
  let roll=randomInt(sum);
  for(let i=minimum;i<6;i++){roll-=weights[i];if(roll<0)return i as Rarity;}
  throw new GameError('INTERNAL_ERROR','Tirage impossible.',500);
}

function effective(b:BoosterRow,r:Reserve,time:number):{available:number;refill:string}{
  if(b.kind==='daily'){
    const day=new Date(time).toISOString().slice(0,10);
    return day>r.last_refill.slice(0,10)?{available:1,refill:day+'T00:00:00.000Z'}:{available:r.available,refill:r.last_refill};
  }
  if(b.kind==='free'){
    ensure(b.cooldown_seconds>0,'INTERNAL_ERROR','Recharge invalide.',500);
    const period=b.cooldown_seconds*1000;
    const elapsed=Math.max(0,Math.floor((time-Date.parse(r.last_refill))/period));
    const available=Math.min(b.capacity,r.available+elapsed);
    const tick=available===b.capacity?time:Date.parse(r.last_refill)+elapsed*period;
    return {available,refill:new Date(tick).toISOString()};
  }
  return {available:r.available,refill:r.last_refill};
}

async function balance(client:PoolClient,userId:string,amount:number,reason:string,reference:string):Promise<void>{
  const res=await client.query<{balance:number}>('SELECT balance FROM users WHERE id=$1 FOR UPDATE',[userId]);
  ensure(res.rows[0],'AUTH_REQUIRED','Session invalide.',401);
  const next=res.rows[0].balance+amount;
  ensure(Number.isSafeInteger(next)&&next>=0&&next<=1000000000,'CONFLICT','Solde invalide.',409);
  await client.query('UPDATE users SET balance=$1 WHERE id=$2',[next,userId]);
  await client.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
    [randomUUID(),userId,amount,next,reason,new Date().toISOString(),reference]);
}

/** Atomic five-card booster opening. Holds user lock across idempotency, inventory, rewards and reserve. */
export async function openPgBooster(userId:string,boosterId:string,key:string):Promise<ActionResult>{
  const actionHash=createHash('sha256').update(JSON.stringify({type:'open',boosterId})).digest('hex');
  return pgTransaction(async client=>{
    const locked=await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
    ensure(locked.rowCount===1,'AUTH_REQUIRED','Connexion requise.',401);
    const prior=await client.query<{action_hash:string;response:string}>(
      'SELECT action_hash,response FROM idempotency WHERE user_id=$1 AND key=$2',[userId,key]);
    if(prior.rows[0]){
      ensure(prior.rows[0].action_hash===actionHash,'IDEMPOTENCY_CONFLICT','Clé déjà utilisée.',409);
      return JSON.parse(prior.rows[0].response) as ActionResult;
    }
    const found=await client.query<BoosterRow>('SELECT * FROM boosters WHERE id=$1',[boosterId]);
    const booster=found.rows[0];
    ensure(booster,'NOT_FOUND','Booster introuvable.',404);
    if(booster.event_id){
      const event=await client.query<{active:number;starts_at:string;ends_at:string;reward:number}>(
        'SELECT active,starts_at,ends_at,reward FROM events WHERE id=$1',[booster.event_id]);
      const e=event.rows[0],now=new Date().toISOString();
      ensure(!!e?.active && e.starts_at<=now && e.ends_at>now,'UNAVAILABLE','Événement terminé.',409);
    }
    const reserveRows=await client.query<Reserve>(
      'SELECT available,last_refill,pity_count FROM user_boosters WHERE user_id=$1 AND booster_id=$2 FOR UPDATE',[userId,boosterId]);
    const reserve=reserveRows.rows[0];
    ensure(reserve,'UNAVAILABLE','Réserve introuvable.',409);
    const computed=effective(booster,reserve,Date.now());
    ensure(computed.available>0,'UNAVAILABLE','Booster non disponible.',409);
    const candidates=await client.query<{id:string;rarity:Rarity}>(
      'SELECT id,rarity FROM cards WHERE NOT (id=ANY($1::text[])) AND ($2::text IS NULL OR series_id=$2)',
      [Array.from(HIDDEN_DUPLICATE_CARD_IDS),booster.series_id]);
    for(let i=0;i<6;i++)
      ensure(candidates.rows.some(c=>c.rarity===i),'INTERNAL_ERROR','Rareté indisponible.',500);
    const weights=JSON.parse(booster.weights) as number[];
    ensure(Array.isArray(weights)&&weights.length===6,'INTERNAL_ERROR','Probabilités invalides.',500);
    const pity=reserve.pity_count+1>=booster.pity_limit;
    const openingId=randomUUID(),date=new Date().toISOString();
    const cards:DrawnCard[]=[];
    let mythic=false;
    for(let slot=0;slot<GAME_CONFIG.cardsPerBooster;slot++){
      const min=slot===4?(pity?5:booster.guarantee):slot===3?1:0;
      const rarity=weighted(weights,min);
      const pool=candidates.rows.filter(c=>c.rarity===rarity);
      const picked=pool[randomInt(pool.length)];
      const before=await client.query<{quantity:number}>(
        'SELECT quantity FROM inventory WHERE user_id=$1 AND card_id=$2',[userId,picked.id]);
      const discovered=await client.query(
        'SELECT 1 FROM acquisitions WHERE user_id=$1 AND card_id=$2 LIMIT 1',[userId,picked.id]);
      cards.push({cardId:picked.id,isNew:discovered.rowCount===0,quantityBefore:before.rows[0]?.quantity||0});
      await client.query(
        `INSERT INTO inventory(user_id,card_id,quantity,favorite,first_obtained_at,last_obtained_at)
         VALUES($1,$2,1,0,$3,$3) ON CONFLICT(user_id,card_id)
         DO UPDATE SET quantity=inventory.quantity+1,last_obtained_at=EXCLUDED.last_obtained_at`,
        [userId,picked.id,date]);
      await client.query(
        'INSERT INTO acquisitions(id,user_id,card_id,quantity,source,created_at,reference_id) VALUES($1,$2,$3,1,$4,$5,$6)',
        [randomUUID(),userId,picked.id,'booster : '+booster.name,date,openingId]);
      if(rarity===5)mythic=true;
    }
    await client.query('UPDATE user_boosters SET available=$1,last_refill=$2,pity_count=$3 WHERE user_id=$4 AND booster_id=$5',
      [computed.available-1,computed.refill,mythic?0:reserve.pity_count+1,userId,boosterId]);
    let reward=booster.kind==='daily'?25:5;
    if(booster.event_id){
      const first=await client.query(
        'INSERT INTO event_rewards(user_id,event_id,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id',
        [userId,booster.event_id,date]);
      if(first.rowCount){
        const event=await client.query<{reward:number}>('SELECT reward FROM events WHERE id=$1',[booster.event_id]);
        reward+=event.rows[0].reward;
      }
    }
    const opening={id:openingId,boosterId,createdAt:date,cards,shardsReward:reward,pityTriggered:pity};
    await client.query('INSERT INTO openings(id,user_id,booster_id,created_at,cards,shards_reward,pity_triggered) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [openingId,userId,boosterId,date,JSON.stringify(cards),reward,pity?1:0]);
    await balance(client,userId,reward,'Ouverture : '+booster.name,openingId);
    await awardPgReferral(client,userId);
    await awardPgAchievements(client,userId);
    await client.query('INSERT INTO activities(id,user_id,kind,message,created_at) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(),userId,'opening',booster.name+' : cinq cartes découvertes.',date]);
    const result:ActionResult={type:'open',message:'Vos cinq cartes ont rejoint votre collection.',opening,amount:reward};
    await client.query('INSERT INTO idempotency(user_id,key,action_hash,response,created_at) VALUES($1,$2,$3,$4,$5)',
      [userId,key,actionHash,JSON.stringify(result),date]);
    return result;
  });
}
