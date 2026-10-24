import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {HIDDEN_DUPLICATE_CARD_IDS} from './card-visibility';
import {ensure} from './errors';

/** Award earned achievements exactly once, within the triggering game transaction. */
export async function awardPgAchievements(db:PoolClient,userId:string):Promise<void>{
 const hidden=Array.from(HIDDEN_DUPLICATE_CARD_IDS);
 const progress=await db.query<{
  openings:number;unique_cards:number;legendary:number;mythic:number;albums:number;recycled:number;transactions:number;
 }>(`SELECT
   (SELECT COUNT(*)::integer FROM openings WHERE user_id=$1) openings,
   (SELECT COUNT(*)::integer FROM inventory WHERE user_id=$1 AND quantity>0 AND NOT(card_id=ANY($2::text[]))) unique_cards,
   (SELECT COUNT(*)::integer FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=$1 AND c.rarity=4 AND NOT(c.id=ANY($2::text[]))) legendary,
   (SELECT COUNT(*)::integer FROM acquisitions a JOIN cards c ON c.id=a.card_id WHERE a.user_id=$1 AND c.rarity=5 AND NOT(c.id=ANY($2::text[]))) mythic,
   (SELECT COUNT(*)::integer FROM series s WHERE EXISTS(SELECT 1 FROM cards c WHERE c.series_id=s.id AND NOT(c.id=ANY($2::text[])))
      AND NOT EXISTS(SELECT 1 FROM cards c WHERE c.series_id=s.id AND NOT(c.id=ANY($2::text[]))
        AND NOT EXISTS(SELECT 1 FROM inventory i WHERE i.user_id=$1 AND i.card_id=c.id AND i.quantity>0))) albums,
   (SELECT COUNT(*)::integer FROM activities WHERE user_id=$1 AND kind='recycle') recycled,
   (SELECT COUNT(*)::integer FROM activities WHERE user_id=$1 AND kind='market') transactions`,[userId,hidden]);
 const p=progress.rows[0];
 const values:Record<string,number>={
  'first-opening':p.openings,'ten-openings':p.openings,
  'ten-unique':p.unique_cards,'fifty-unique':p.unique_cards,
  'first-legendary':p.legendary,'first-mythic':p.mythic,
  'first-album':p.albums,'first-recycle':p.recycled,'first-transaction':p.transactions
 };
 const achievements=await db.query<{id:string;name:string;target:number;reward:number}>('SELECT id,name,target,reward FROM achievements ORDER BY id');
 for(const a of achievements.rows){
  if((values[a.id]||0)<a.target)continue;
  const date=new Date().toISOString();
  const inserted=await db.query('INSERT INTO user_achievements(user_id,achievement_id,unlocked_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING achievement_id',[userId,a.id,date]);
  if(!inserted.rowCount)continue;
  const updated=await db.query<{balance:number}>('UPDATE users SET balance=balance+$1 WHERE id=$2 AND balance+$1<=1000000000 RETURNING balance',[a.reward,userId]);
  ensure(updated.rowCount===1,'CONFLICT','Solde maximum dépassé.',409);
  await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
   [randomUUID(),userId,a.reward,updated.rows[0].balance,'Succès : '+a.name,date,a.id]);
  await db.query('INSERT INTO activities(id,user_id,kind,message,created_at) VALUES($1,$2,$3,$4,$5)',
   [randomUUID(),userId,'achievement','Succès débloqué : '+a.name+'.',date]);
 }
}
