import {createHash,randomUUID} from 'node:crypto';
import type {Action,ActionResult} from '../lib/contracts';
import {ensure} from './errors';
import {pgTransaction} from './postgres';
type Recycling=Extract<Action,{type:'recycle'}>;
export async function pgRecycle(userId:string,action:Recycling,key:string):Promise<ActionResult>{
 const digest=createHash('sha256').update(JSON.stringify(action)).digest('hex');
 return pgTransaction(async db=>{
  const user=await db.query<{balance:number}>('SELECT balance FROM users WHERE id=$1 FOR UPDATE',[userId]);
  ensure(user.rows[0],'AUTH_REQUIRED','Connexion requise.',401);
  const prior=await db.query<{action_hash:string;response:string}>('SELECT action_hash,response FROM idempotency WHERE user_id=$1 AND key=$2',[userId,key]);
  if(prior.rows[0]){
   ensure(prior.rows[0].action_hash===digest,'IDEMPOTENCY_CONFLICT','Clé déjà utilisée.',409);
   return JSON.parse(prior.rows[0].response) as ActionResult;
  }
  const rows=await db.query<{card_id:string;quantity:number;recycle_value:number}>(`SELECT i.card_id,i.quantity,c.recycle_value
   FROM inventory i JOIN cards c ON c.id=i.card_id WHERE i.user_id=$1 AND i.quantity>1
   AND ($2::text IS NULL OR i.card_id=$2) ORDER BY i.card_id FOR UPDATE OF i`,[userId,action.cardId??null]);
  ensure(rows.rows.length>0,'UNAVAILABLE','Aucun doublon à recycler.',409);
  let amount=0,quantity=0;
  for(const row of rows.rows){
   const n=row.quantity-1; quantity+=n;amount+=n*row.recycle_value;
   await db.query('UPDATE inventory SET quantity=1 WHERE user_id=$1 AND card_id=$2',[userId,row.card_id]);
  }
  const next=user.rows[0].balance+amount;
  ensure(Number.isSafeInteger(next)&&next<=1000000000,'CONFLICT','Solde maximum dépassé.',409);
  const date=new Date().toISOString();
  await db.query('UPDATE users SET balance=$1 WHERE id=$2',[next,userId]);
  await db.query('INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,NULL)',
   [randomUUID(),userId,amount,next,'Recyclage de doublons',date]);
  const result:ActionResult={type:'recycle',message:`${quantity} doublons recyclés. Un exemplaire de chaque carte est conservé.`,amount,quantity};
  await db.query('INSERT INTO activities(id,user_id,kind,message,created_at) VALUES($1,$2,$3,$4,$5)',
   [randomUUID(),userId,'recycle',result.message,date]);
  await db.query('INSERT INTO idempotency(user_id,key,action_hash,response,created_at) VALUES($1,$2,$3,$4,$5)',
   [userId,key,digest,JSON.stringify(result),date]);
  return result;
 });
}
