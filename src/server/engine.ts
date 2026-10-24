import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Action, ActionResult } from '../lib/contracts';
import { all, getDb, id, now, one, transaction } from './database';
import { ensure, GameError } from './errors';
import { parseAction } from './validation';
import { openBooster,buyBooster } from './game';
import { logActivity,recycle } from './economy';
import { createListing,buyListing,cancelListing } from './market';
import { createTrade,respondTrade } from './trades';
import { evaluateAchievements,evaluateReferral } from './achievements';
export { getState } from './state';
export { parseAction,GameError };

function canonical(value:unknown):string {
  if(value===null || typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key])}`).join(',')}}`;
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function executeAction(userId:string,rawAction:Action,idempotencyKey:string):ActionResult {
  const action=parseAction(rawAction);
  ensure(z.uuid().safeParse(idempotencyKey).success,'VALIDATION_ERROR','Une clé d’idempotence UUID valide est obligatoire.',422);
  ensure(!['login-dev','logout'].includes(action.type),'VALIDATION_ERROR','Cette action doit utiliser le service d’authentification.');
  const actionHash=hash(canonical(action));
  return transaction(()=>{
    ensure(one('SELECT 1 FROM users WHERE id=?',userId),'AUTH_REQUIRED','Connectez-vous pour continuer.',401);
    const receipt=one<{action_hash:string;response:string}>('SELECT action_hash,response FROM idempotency WHERE user_id=? AND key=?',userId,idempotencyKey);
    if(receipt) {
      ensure(receipt.action_hash===actionHash,'IDEMPOTENCY_CONFLICT','Cette clé d’idempotence a déjà été utilisée pour une autre action.',409);
      return JSON.parse(receipt.response) as ActionResult;
    }
    let result:ActionResult;
    switch(action.type) {
      case 'open':result=openBooster(userId,action.boosterId);break;
      case 'buy-booster':result=buyBooster(userId,action.boosterId,action.quantity);break;
      case 'recycle':result=recycle(userId,action.cardId);break;
      case 'listing-create':result=createListing(userId,action.cardId,action.quantity,action.price);break;
      case 'listing-buy':result=buyListing(userId,action.listingId);break;
      case 'listing-cancel':result=cancelListing(userId,action.listingId);break;
      case 'trade-create':result=createTrade(userId,action.recipientId,action.offered,action.requested);break;
      case 'trade-respond':result=respondTrade(userId,action.tradeId,action.decision);break;
      case 'favorite': {
        ensure(one('SELECT 1 FROM inventory WHERE user_id=? AND card_id=? AND quantity>0',userId,action.cardId),'NOT_FOUND','Cette carte ne figure pas dans votre collection.',404);
        getDb().prepare('UPDATE inventory SET favorite=1-favorite WHERE user_id=? AND card_id=?').run(userId,action.cardId);
        result={type:action.type,message:'Favori mis à jour.'};break;
      }
      case 'preferences':getDb().prepare('UPDATE users SET reduced_motion=? WHERE id=?').run(action.reducedMotion?1:0,userId);result={type:action.type,message:'Préférences enregistrées.'};break;
      case 'event-save': {
        ensure(one<{role:string}>('SELECT role FROM users WHERE id=?',userId)!.role==='admin','FORBIDDEN','Cette action est réservée à l’administration.',403);
        const start=new Date(action.startsAt).toISOString(),end=new Date(action.endsAt).toISOString();
        ensure(end>start,'VALIDATION_ERROR','La fin doit être postérieure au début.');
        const eventId=action.id||id();
        if(action.id)ensure(one('SELECT 1 FROM events WHERE id=?',action.id),'NOT_FOUND','Événement introuvable.',404);
        getDb().prepare('INSERT INTO events VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active,color=excluded.color,reward=excluded.reward').run(eventId,action.name,action.description,start,end,action.active?1:0,action.color,action.reward);
        logActivity(userId,'event',`Événement mis à jour : ${action.name}.`);
        result={type:action.type,message:'Événement enregistré.',entityId:eventId};break;
      }
      case 'referral': {
        const user=one<{referred_by:string|null}>('SELECT referred_by FROM users WHERE id=?',userId)!;
        ensure(!user.referred_by&&!one('SELECT 1 FROM referral_rewards WHERE referred_id=?',userId),'CONFLICT','Vous avez déjà enregistré un parrain.',409);
        const referrer=one<{id:string}>('SELECT id FROM users WHERE referral_code=?',action.code.toUpperCase());
        ensure(referrer,'NOT_FOUND','Code de parrainage introuvable.',404);
        ensure(referrer.id!==userId,'VALIDATION_ERROR','Vous ne pouvez pas utiliser votre propre code.');
        const chain=all<{id:string}>(`WITH RECURSIVE ancestors(id) AS (SELECT referred_by FROM users WHERE id=? UNION SELECT u.referred_by FROM users u JOIN ancestors a ON u.id=a.id WHERE u.referred_by IS NOT NULL) SELECT id FROM ancestors`,referrer.id);
        ensure(!chain.some(u=>u.id===userId),'CONFLICT','Ce parrainage formerait une boucle.',409);
        getDb().prepare('UPDATE users SET referred_by=? WHERE id=?').run(referrer.id,userId);
        result={type:action.type,message:'Parrain enregistré. La récompense arrive après trois ouvertures.'};break;
      }
      case 'account-delete': {
        ensure(one<{username:string}>('SELECT username FROM users WHERE id=?',userId)!.username===action.confirmation,'VALIDATION_ERROR','Saisissez exactement votre pseudonyme pour confirmer la suppression.',422);
        getDb().prepare("UPDATE listings SET status='cancelled',completed_at=? WHERE seller_id=? AND status='active'").run(now(),userId);
        getDb().prepare('DELETE FROM users WHERE id=?').run(userId);
        result={type:action.type,message:'Compte et données personnelles supprimés.'};
        getDb().prepare('INSERT INTO auth_receipts VALUES(?,?,?,?)').run(hash(idempotencyKey),hash(JSON.stringify({type:'account-delete',confirmation:action.confirmation})),JSON.stringify({result}),new Date(Date.now()+86400000).toISOString());
        return result;
      }
      default:throw new GameError('VALIDATION_ERROR','Action inconnue.');
    }
    evaluateAchievements(userId);evaluateReferral(userId);
    getDb().prepare('INSERT INTO idempotency VALUES(?,?,?,?,?)').run(userId,idempotencyKey,actionHash,JSON.stringify(result),now());
    return result;
  });
}
