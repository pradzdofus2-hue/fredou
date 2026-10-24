import {awardPgAchievements} from './postgres-achievements';
import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Action,ActionResult,TradeItem} from '../lib/contracts';
import {GAME_CONFIG} from './config';
import {ensure} from './errors';
import {pgTransaction} from './postgres';

type TradeAction=Extract<Action,{type:'trade-create'|'trade-respond'}>;
type Row={id:string;sender_id:string;recipient_id:string;offered:string;requested:string;status:string};
async function validate(db:PoolClient,user:string,items:TradeItem[]):Promise<number>{
 ensure(items.length>0&&items.length<=GAME_CONFIG.maxTradeItems,'VALIDATION_ERROR','Nombre de cartes invalide.');
 ensure(new Set(items.map(x=>x.cardId)).size===items.length,'VALIDATION_ERROR','Cartes répétées.');
 let value=0,count=0;
 for(const item of items){
  ensure(Number.isSafeInteger(item.quantity)&&item.quantity>=1,'VALIDATION_ERROR','Quantité invalide.');
  count+=item.quantity;
  const rows=await db.query<{quantity:number;recycle_value:number}>('SELECT i.quantity,c.recycle_value FROM inventory i JOIN cards c ON c.id=i.card_id WHERE i.user_id=$1 AND i.card_id=$2',[user,item.cardId]);
  ensure(rows.rows[0]&&rows.rows[0].quantity>=item.quantity,'CONFLICT','Cartes insuffisantes.',409);
  value+=rows.rows[0].recycle_value*item.quantity;
 }
 ensure(count<=GAME_CONFIG.maxTradeQuantity,'VALIDATION_ERROR','Trop de cartes.',422);
 return value;
}
function fairness(a:number,b:number):void{
 ensure(a>0&&b>0&&Math.max(a,b)/Math.min(a,b)<=GAME_CONFIG.maxTradeValueRatio,'CONFLICT','Échange déséquilibré.',409);
}
async function move(db:PoolClient,from:string,to:string,items:TradeItem[],tradeId:string,date:string):Promise<void>{
 for(const item of items){
  const removed=await db.query('UPDATE inventory SET quantity=quantity-$1 WHERE user_id=$2 AND card_id=$3 AND quantity>=$1 RETURNING quantity',[item.quantity,from,item.cardId]);
  ensure(removed.rowCount===1,'CONFLICT','Cartes indisponibles.',409);
  await db.query(`INSERT INTO inventory(user_id,card_id,quantity,favorite,first_obtained_at,last_obtained_at)
   VALUES($1,$2,$3,0,$4,$4) ON CONFLICT(user_id,card_id)
   DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity,last_obtained_at=EXCLUDED.last_obtained_at`,[to,item.cardId,item.quantity,date]);
  await db.query('INSERT INTO acquisitions(id,user_id,card_id,quantity,source,created_at,reference_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),to,item.cardId,item.quantity,'échange',date,tradeId]);
 }
}
export async function pgTradeAction(userId:string,action:TradeAction,key:string):Promise<ActionResult>{
 const digest=createHash('sha256').update(JSON.stringify(action)).digest('hex');
 return pgTransaction(async db=>{
  // Serialize the actor's actions before checking idempotency.
  const actor=await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  ensure(actor.rowCount===1,'AUTH_REQUIRED','Connexion requise.',401);
  const old=await db.query<{action_hash:string;response:string}>('SELECT action_hash,response FROM idempotency WHERE user_id=$1 AND key=$2',[userId,key]);
  if(old.rows[0]){
   ensure(old.rows[0].action_hash===digest,'IDEMPOTENCY_CONFLICT','Clé déjà utilisée.',409);
   return JSON.parse(old.rows[0].response) as ActionResult;
  }
  let result:ActionResult;
  const date=new Date().toISOString();
  if(action.type==='trade-create'){
   ensure(userId!==action.recipientId,'VALIDATION_ERROR','Choisissez un autre joueur.');
   ensure(!action.offered.some(x=>action.requested.some(y=>y.cardId===x.cardId)),'VALIDATION_ERROR','Carte présente des deux côtés.');
   const other=await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[action.recipientId]);
   ensure(other.rowCount===1,'NOT_FOUND','Destinataire introuvable.',404);
   const pending=await db.query<{n:number}>("SELECT COUNT(*)::integer n FROM trades WHERE sender_id=$1 AND status='pending'",[userId]);
   ensure(pending.rows[0].n<20,'CONFLICT','Vingt échanges en attente.',409);
   fairness(await validate(db,userId,action.offered),await validate(db,action.recipientId,action.requested));
   const id=randomUUID();
   await db.query("INSERT INTO trades(id,sender_id,recipient_id,offered,requested,status,created_at,resolved_at) VALUES($1,$2,$3,$4,$5,'pending',$6,NULL)",[id,userId,action.recipientId,JSON.stringify(action.offered),JSON.stringify(action.requested),date]);
   result={type:'trade-create',message:'Proposition envoyée.',entityId:id};
  }else{
   const found=await db.query<Row>('SELECT * FROM trades WHERE id=$1 FOR UPDATE',[action.tradeId]);
   const trade=found.rows[0];
   ensure(trade,'NOT_FOUND','Échange introuvable.',404);
   ensure(trade.status==='pending','CONFLICT','Échange déjà traité.',409);
   ensure(action.decision==='cancel'?trade.sender_id===userId:trade.recipient_id===userId,'FORBIDDEN','Action interdite.',403);
   if(action.decision==='accept'){
    const otherId=trade.sender_id===userId?trade.recipient_id:trade.sender_id;
    const other=await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[otherId]);
    ensure(other.rowCount===1,'CONFLICT','Joueur indisponible.',409);
    const offered=JSON.parse(trade.offered) as TradeItem[],requested=JSON.parse(trade.requested) as TradeItem[];
    fairness(await validate(db,trade.sender_id,offered),await validate(db,trade.recipient_id,requested));
    await move(db,trade.sender_id,trade.recipient_id,offered,trade.id,date);
    await move(db,trade.recipient_id,trade.sender_id,requested,trade.id,date);
    await awardPgAchievements(db,trade.sender_id);
    await awardPgAchievements(db,trade.recipient_id);
   }
   const status=action.decision==='accept'?'accepted':action.decision==='reject'?'rejected':'cancelled';
   await db.query('UPDATE trades SET status=$1,resolved_at=$2 WHERE id=$3',[status,date,trade.id]);
   result={type:'trade-respond',message:action.decision==='accept'?'Échange accepté.':action.decision==='reject'?'Proposition refusée.':'Proposition annulée.',entityId:trade.id};
  }
  await db.query('INSERT INTO activities(id,user_id,kind,message,created_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),userId,'trade',result.message,date]);
  await db.query('INSERT INTO idempotency(user_id,key,action_hash,response,created_at) VALUES($1,$2,$3,$4,$5)',[userId,key,digest,JSON.stringify(result),date]);
  return result;
 });
}
