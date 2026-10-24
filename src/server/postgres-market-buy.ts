import { createHash, randomUUID } from 'node:crypto';
import { pgTransaction } from './postgres';
import { ensure } from './errors';
import type { ActionResult } from '../lib/contracts';

export async function pgBuyListing(userId:string, listingId:string, key:string):Promise<ActionResult>{
 const digest=createHash('sha256').update(JSON.stringify({type:'listing-buy',listingId})).digest('hex');
 return pgTransaction(async db=>{
  const buyer=await db.query<{balance:number}>('SELECT balance FROM users WHERE id=$1 FOR UPDATE',[userId]);
  ensure(buyer.rows[0],'AUTH_REQUIRED','Compte introuvable.',401);
  const prior=await db.query<{action_hash:string;response:string}>('SELECT action_hash,response FROM idempotency WHERE user_id=$1 AND key=$2',[userId,key]);
  if(prior.rows[0]){
   ensure(prior.rows[0].action_hash===digest,'IDEMPOTENCY_CONFLICT','Clé déjà utilisée.',409);
   return JSON.parse(prior.rows[0].response) as ActionResult;
  }
  const found=await db.query<{id:string;seller_id:string|null;card_id:string;price:number;quantity:number;status:string}>('SELECT * FROM listings WHERE id=$1 FOR UPDATE',[listingId]);
  const listing=found.rows[0];
  ensure(listing,'NOT_FOUND','Annonce introuvable.',404);
  ensure(listing.status==='active'&&!!listing.seller_id,'CONFLICT','Annonce indisponible.',409);
  ensure(listing.seller_id!==userId,'FORBIDDEN','Achat personnel interdit.',403);
  const seller=await db.query<{balance:number}>('SELECT balance FROM users WHERE id=$1 FOR UPDATE',[listing.seller_id]);
  ensure(seller.rows[0],'CONFLICT','Vendeur introuvable.',409);
  const total=listing.price*listing.quantity;
  ensure(Number.isSafeInteger(total)&&total>0,'CONFLICT','Prix invalide.',409);
  ensure(buyer.rows[0].balance>=total,'INSUFFICIENT_FUNDS','Éclats insuffisants.',409);
  const buyerBalance=buyer.rows[0].balance-total;
  const sellerBalance=seller.rows[0].balance+total;
  ensure(Number.isSafeInteger(sellerBalance)&&sellerBalance<=1000000000,'CONFLICT','Solde vendeur plafonné.',409);
  const date=new Date().toISOString();
  await db.query('UPDATE users SET balance=$1 WHERE id=$2',[buyerBalance,userId]);
  await db.query('UPDATE users SET balance=$1 WHERE id=$2',[sellerBalance,listing.seller_id]);
  await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),userId,-total,buyerBalance,'Achat marché',date,listingId]);
  await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),listing.seller_id,total,sellerBalance,'Vente marché',date,listingId]);
  await db.query(`INSERT INTO inventory(user_id,card_id,quantity,favorite,first_obtained_at,last_obtained_at)
   VALUES($1,$2,$3,0,$4,$4) ON CONFLICT(user_id,card_id)
   DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,last_obtained_at=EXCLUDED.last_obtained_at`,[userId,listing.card_id,listing.quantity,date]);
  await db.query('INSERT INTO acquisitions(id,user_id,card_id,quantity,source,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),userId,listing.card_id,listing.quantity,'marché',date,listingId]);
  await db.query("UPDATE listings SET status='sold',buyer_id=$1,completed_at=$2 WHERE id=$3",[userId,date,listingId]);
  await db.query('INSERT INTO price_history(id,listing_id,card_id,unit_price,quantity,sold_at) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),listingId,listing.card_id,listing.price,listing.quantity,date]);
  const result:ActionResult={type:'listing-buy',message:'Achat réussi. Les cartes ont rejoint votre collection.',amount:total,quantity:listing.quantity,entityId:listingId};
  await db.query('INSERT INTO idempotency(user_id,key,action_hash,response,created_at) VALUES($1,$2,$3,$4,$5)',[userId,key,digest,JSON.stringify(result),date]);
  return result;
 });
}
