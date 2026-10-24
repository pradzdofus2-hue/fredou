import { createHash, randomUUID } from 'node:crypto';
import { pgTransaction } from './postgres';
import { ensure } from './errors';
import type { Action, ActionResult } from '../lib/contracts';

type ListingAction = Extract<Action, {type:'listing-create'|'listing-cancel'}>;

export async function pgListingAction(userId:string, action:ListingAction, key:string):Promise<ActionResult> {
 const digest=createHash('sha256').update(JSON.stringify(action)).digest('hex');
 return pgTransaction(async db => {
  const locked=await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  ensure(locked.rowCount===1,'AUTH_REQUIRED','Compte introuvable.',401);
  const replay=await db.query<{action_hash:string;response:string}>('SELECT action_hash,response FROM idempotency WHERE user_id=$1 AND key=$2',[userId,key]);
  if(replay.rows[0]) {
   ensure(replay.rows[0].action_hash===digest,'IDEMPOTENCY_CONFLICT','Clé déjà utilisée.',409);
   return JSON.parse(replay.rows[0].response) as ActionResult;
  }
  const now=new Date().toISOString();
  let result:ActionResult;
  if(action.type==='listing-create') {
   ensure(Number.isSafeInteger(action.quantity)&&action.quantity>=1&&action.quantity<=50,'VALIDATION_ERROR','Quantité invalide.',422);
   ensure(Number.isSafeInteger(action.price)&&action.price>=1&&action.price<=100000000,'VALIDATION_ERROR','Prix invalide.',422);
   const card=await db.query('SELECT id FROM cards WHERE id=$1',[action.cardId]);
   ensure(card.rowCount===1,'NOT_FOUND','Carte introuvable.',404);
   const active=await db.query<{n:number}>("SELECT COUNT(*)::integer n FROM listings WHERE seller_id=$1 AND status='active'",[userId]);
   ensure(active.rows[0].n<100,'CONFLICT','Maximum cent annonces.',409);
   const deducted=await db.query('UPDATE inventory SET quantity=quantity-$1 WHERE user_id=$2 AND card_id=$3 AND quantity>=$1 RETURNING quantity',[action.quantity,userId,action.cardId]);
   ensure(deducted.rowCount===1,'CONFLICT','Cartes insuffisantes.',409);
   const id=randomUUID();
   await db.query("INSERT INTO listings(id,seller_id,card_id,quantity,price,status,buyer_id,created_at,completed_at) VALUES($1,$2,$3,$4,$5,'active',NULL,$6,NULL)",[id,userId,action.cardId,action.quantity,action.price,now]);
   result={type:'listing-create',message:'Annonce publiée. Les cartes sont réservées.',entityId:id};
  } else {
   const found=await db.query<{seller_id:string|null;card_id:string;quantity:number;status:string}>('SELECT seller_id,card_id,quantity,status FROM listings WHERE id=$1 FOR UPDATE',[action.listingId]);
   const listing=found.rows[0];
   ensure(listing,'NOT_FOUND','Annonce introuvable.',404);
   ensure(listing.seller_id===userId,'FORBIDDEN','Annonce non autorisée.',403);
   ensure(listing.status==='active','CONFLICT','Annonce indisponible.',409);
   await db.query(`INSERT INTO inventory(user_id,card_id,quantity,favorite,first_obtained_at,last_obtained_at)
    VALUES($1,$2,$3,0,$4,$4) ON CONFLICT(user_id,card_id)
    DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,last_obtained_at=EXCLUDED.last_obtained_at`,[userId,listing.card_id,listing.quantity,now]);
   await db.query("UPDATE listings SET status='cancelled',completed_at=$1 WHERE id=$2",[now,action.listingId]);
   result={type:'listing-cancel',message:'Annonce annulée et cartes rendues.',entityId:action.listingId};
  }
  await db.query('INSERT INTO activities(id,user_id,kind,message,created_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),userId,'listing',result.message,now]);
  await db.query('INSERT INTO idempotency(user_id,key,action_hash,response,created_at) VALUES($1,$2,$3,$4,$5)',[userId,key,digest,JSON.stringify(result),now]);
  return result;
 });
}
