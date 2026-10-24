import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {GAME_CONFIG} from './config';
import {ensure} from './errors';

/** Called after an opening, on the same transaction and under the referred user's lock. */
export async function awardPgReferral(db:PoolClient,userId:string):Promise<void>{
 const found=await db.query<{referred_by:string|null}>('SELECT referred_by FROM users WHERE id=$1',[userId]);
 const referrer=found.rows[0]?.referred_by;
 if(!referrer)return;
 const opens=await db.query<{n:number}>('SELECT COUNT(*)::integer n FROM openings WHERE user_id=$1',[userId]);
 if(opens.rows[0].n<GAME_CONFIG.referralRequiredOpenings)return;
 const date=new Date().toISOString();
 const reserved=await db.query('INSERT INTO referral_rewards(referred_id,referrer_id,created_at) VALUES($1,$2,$3) ON CONFLICT(referred_id) DO NOTHING RETURNING referred_id',[userId,referrer,date]);
 if(!reserved.rowCount)return;
 // Players may delete their accounts while a referral is pending.
 for(const recipient of [userId,referrer]){
  const balance=await db.query<{balance:number}>('SELECT balance FROM users WHERE id=$1 FOR UPDATE',[recipient]);
  if(!balance.rows[0])continue;
  const next=balance.rows[0].balance+GAME_CONFIG.referralReward;
  ensure(next<=1000000000,'CONFLICT','Solde maximum dépassé.',409);
  await db.query('UPDATE users SET balance=$1 WHERE id=$2',[next,recipient]);
  await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
   [randomUUID(),recipient,GAME_CONFIG.referralReward,next,'Parrainage confirmé',date,userId]);
  await db.query('INSERT INTO activities(id,user_id,kind,message,created_at) VALUES($1,$2,$3,$4,$5)',
   [randomUUID(),recipient,'referral','Parrainage confirmé après trois ouvertures.',date]);
 }
}
