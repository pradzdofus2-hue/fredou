import type { ActionResult, TradeItem, Trade } from '../lib/contracts';
import { getDb, id, now, one } from './database';
import { acquire, logActivity, removeCards } from './economy';
import { ensure } from './errors';
import { GAME_CONFIG } from './config';
import { evaluateAchievements } from './achievements';
interface TradeRow {id:string;sender_id:string;recipient_id:string;offered:string;requested:string;status:Trade['status'];created_at:string;resolved_at:string|null;}
function validateItems(userId:string,items:TradeItem[]):number {
  ensure(items.length>0&&items.length<=GAME_CONFIG.maxTradeItems,'VALIDATION_ERROR','Nombre de cartes invalide.');
  ensure(new Set(items.map(i=>i.cardId)).size===items.length,'VALIDATION_ERROR','Une carte ne peut apparaître qu’une fois par côté de l’échange.');
  let value=0,total=0;
  for(const item of items) {
    total+=item.quantity;
    const record=one<{quantity:number;recycle_value:number}>('SELECT i.quantity,c.recycle_value FROM inventory i JOIN cards c ON c.id=i.card_id WHERE user_id=? AND card_id=?',userId,item.cardId);
    ensure(record&&record.quantity>=item.quantity,'CONFLICT','Une des cartes de l’échange n’est plus disponible en quantité suffisante.',409);
    value+=record.recycle_value*item.quantity;
  }
  ensure(total<=GAME_CONFIG.maxTradeQuantity,'VALIDATION_ERROR',`Un échange est limité à ${GAME_CONFIG.maxTradeQuantity} exemplaires de chaque côté.`);
  return value;
}
function validateFairness(offered:number,requested:number):void {
  ensure(Math.max(offered,requested)/Math.min(offered,requested)<=GAME_CONFIG.maxTradeValueRatio,'CONFLICT',`L’écart de valeur de recyclage dépasse le ratio autorisé (${GAME_CONFIG.maxTradeValueRatio}:1).`,409);
}
export function createTrade(userId:string,recipientId:string,offered:TradeItem[],requested:TradeItem[]):ActionResult {
  ensure(userId!==recipientId,'VALIDATION_ERROR','Un échange nécessite deux joueurs différents.');
  ensure(!offered.some(item=>requested.some(other=>other.cardId===item.cardId)),'VALIDATION_ERROR','Une même carte ne peut figurer des deux côtés de l’échange.');
  ensure(one('SELECT 1 FROM users WHERE id=?',recipientId),'NOT_FOUND','Destinataire introuvable.',404);
  ensure(one<{count:number}>("SELECT COUNT(*) count FROM trades WHERE sender_id=? AND status='pending'",userId)!.count<20,'CONFLICT','Vous avez déjà vingt propositions en attente.',409);
  validateFairness(validateItems(userId,offered),validateItems(recipientId,requested));
  const tradeId=id();
  getDb().prepare("INSERT INTO trades VALUES(?,?,?,?,?,'pending',?,NULL)").run(tradeId,userId,recipientId,JSON.stringify(offered),JSON.stringify(requested),now());
  logActivity(userId,'trade','Nouvelle proposition d’échange envoyée.');
  return {type:'trade-create',message:'Proposition envoyée. Les cartes seront vérifiées à nouveau lors de l’acceptation.',entityId:tradeId};
}
export function respondTrade(userId:string,tradeId:string,decision:'accept'|'reject'|'cancel'):ActionResult {
  const trade=one<TradeRow>('SELECT * FROM trades WHERE id=?',tradeId);
  ensure(trade,'NOT_FOUND','Échange introuvable.',404);
  ensure(trade.status==='pending','CONFLICT','Cet échange a déjà été traité.',409);
  ensure(decision==='cancel'?trade.sender_id===userId:trade.recipient_id===userId,'FORBIDDEN','Vous n’êtes pas autorisé à traiter cette proposition.',403);
  if(decision==='accept') {
    const offered=JSON.parse(trade.offered) as TradeItem[],requested=JSON.parse(trade.requested) as TradeItem[];
    validateFairness(validateItems(trade.sender_id,offered),validateItems(trade.recipient_id,requested));
    for(const item of offered)removeCards(trade.sender_id,item.cardId,item.quantity);
    for(const item of requested)removeCards(trade.recipient_id,item.cardId,item.quantity);
    for(const item of offered)acquire(trade.recipient_id,item.cardId,item.quantity,'échange',tradeId);
    for(const item of requested)acquire(trade.sender_id,item.cardId,item.quantity,'échange',tradeId);
    logActivity(trade.sender_id,'trade','Échange accepté : les cartes ont été transférées.');
    logActivity(trade.recipient_id,'trade','Échange accepté : les cartes ont été transférées.');
    evaluateAchievements(trade.sender_id);
  }
  getDb().prepare('UPDATE trades SET status=?,resolved_at=? WHERE id=?').run(decision==='accept'?'accepted':decision==='reject'?'rejected':'cancelled',now(),tradeId);
  return {type:'trade-respond',message:decision==='accept'?'Échange accepté. Les deux collections ont été mises à jour.':decision==='reject'?'Proposition refusée.':'Proposition annulée.',entityId:tradeId};
}
