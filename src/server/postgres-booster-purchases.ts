import { createHash, randomUUID } from 'node:crypto';
import { pgTransaction } from './postgres';
import { ensure } from './errors';
import type { ActionResult } from '../lib/contracts';

export async function buyPgBooster(userId:string,boosterId:string,quantity:number,key:string):Promise<ActionResult>{
  ensure(Number.isInteger(quantity) && quantity>=1 && quantity<=20,'VALIDATION_ERROR','Quantité invalide.',422);
  const digest=createHash('sha256').update(JSON.stringify({type:'buy-booster',boosterId,quantity})).digest('hex');
  return pgTransaction(async db=>{
    const user=await db.query<{balance:number}>('SELECT balance FROM users WHERE id=$1 FOR UPDATE',[userId]);
    ensure(user.rows[0],'AUTH_REQUIRED','Connexion requise.',401);
    const replay=await db.query<{action_hash:string;response:string}>('SELECT action_hash,response FROM idempotency WHERE user_id=$1 AND key=$2',[userId,key]);
    if(replay.rows[0]){
      ensure(replay.rows[0].action_hash===digest,'IDEMPOTENCY_CONFLICT','Clé déjà utilisée.',409);
      return JSON.parse(replay.rows[0].response) as ActionResult;
    }
    const found=await db.query<{name:string;price:number;event_id:string|null}>('SELECT name,price,event_id FROM boosters WHERE id=$1',[boosterId]);
    const booster=found.rows[0];
    ensure(booster,'NOT_FOUND','Booster introuvable.',404);
    ensure(booster.price>0,'UNAVAILABLE','Booster non achetable.',409);
    if(booster.event_id){
      const event=await db.query<{active:number;starts_at:string;ends_at:string}>('SELECT active,starts_at,ends_at FROM events WHERE id=$1',[booster.event_id]);
      const e=event.rows[0],now=new Date().toISOString();
      ensure(!!e?.active && e.starts_at<=now && e.ends_at>now,'UNAVAILABLE','Événement inactif.',409);
    }
    const amount=booster.price*quantity,remaining=user.rows[0].balance-amount;
    ensure(Number.isSafeInteger(amount) && remaining>=0,'INSUFFICIENT_FUNDS','Éclats insuffisants.',409);
    const reserve=await db.query('UPDATE user_boosters SET available=available+$1 WHERE user_id=$2 AND booster_id=$3 RETURNING available',[quantity,userId,boosterId]);
    ensure(reserve.rowCount===1,'UNAVAILABLE','Réserve introuvable.',409);
    const date=new Date().toISOString();
    await db.query('UPDATE users SET balance=$1 WHERE id=$2',[remaining,userId]);
    await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),userId,-amount,remaining,'Achat de '+quantity+' booster(s) '+booster.name,date,boosterId]);
    await db.query('INSERT INTO activities(id,user_id,kind,message,created_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),userId,'shop',quantity+' booster(s) '+booster.name+' acheté(s).',date]);
    const result:ActionResult={type:'buy-booster',message:'Les boosters ont rejoint votre réserve.',quantity,amount};
    await db.query('INSERT INTO idempotency(user_id,key,action_hash,response,created_at) VALUES($1,$2,$3,$4,$5)',[userId,key,digest,JSON.stringify(result),date]);
    return result;
  });
}
