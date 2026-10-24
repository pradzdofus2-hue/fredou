import { all, getDb, id, now, one } from './database';
import { ensure } from './errors';
import type { ActionResult } from '../lib/contracts';

/** Caller holds BEGIN IMMEDIATE. Balance and its immutable ledger entry always move together. */
export function adjustBalance(userId: string, amount: number, reason: string, referenceId: string | null = null): number {
  ensure(Number.isSafeInteger(amount), 'VALIDATION_ERROR', 'Montant monétaire invalide.');
  const user = one<{balance:number}>('SELECT balance FROM users WHERE id=?',userId);
  ensure(user,'NOT_FOUND','Joueur introuvable.',404);
  const balance = user.balance + amount;
  ensure(balance>=0,'INSUFFICIENT_FUNDS','Votre solde d’Éclats est insuffisant.',409);
  ensure(Number.isSafeInteger(balance) && balance<=1000000000,'CONFLICT','La limite du solde serait dépassée.',409);
  getDb().prepare('UPDATE users SET balance=? WHERE id=?').run(balance,userId);
  getDb().prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)').run(id(),userId,amount,balance,reason,now(),referenceId);
  return balance;
}
export function acquire(userId: string, cardId: string, quantity: number, source: string, referenceId: string | null): void {
  ensure(Number.isSafeInteger(quantity) && quantity>0,'VALIDATION_ERROR','Quantité invalide.');
  const date = now();
  getDb().prepare(`INSERT INTO inventory(user_id,card_id,quantity,favorite,first_obtained_at,last_obtained_at) VALUES(?,?,?,0,?,?)
    ON CONFLICT(user_id,card_id) DO UPDATE SET quantity=inventory.quantity+excluded.quantity,last_obtained_at=excluded.last_obtained_at`).run(userId,cardId,quantity,date,date);
  getDb().prepare('INSERT INTO acquisitions VALUES(?,?,?,?,?,?,?)').run(id(),userId,cardId,quantity,source,date,referenceId);
}
export function removeCards(userId: string, cardId: string, quantity: number): void {
  ensure(Number.isSafeInteger(quantity) && quantity>0,'VALIDATION_ERROR','Quantité invalide.');
  const result = getDb().prepare('UPDATE inventory SET quantity=quantity-? WHERE user_id=? AND card_id=? AND quantity>=?').run(quantity,userId,cardId,quantity);
  ensure(Number(result.changes)===1,'CONFLICT','Vous ne possédez pas la quantité de cartes demandée.',409);
}
export function logActivity(userId: string, kind: string, message: string): void {
  getDb().prepare('INSERT INTO activities VALUES(?,?,?,?,?)').run(id(),userId,kind,message,now());
}
export function recycle(userId: string, cardId?: string): ActionResult {
  const rows = all<{card_id:string;quantity:number;recycle_value:number}>(`SELECT i.card_id,i.quantity,c.recycle_value FROM inventory i JOIN cards c ON c.id=i.card_id WHERE i.user_id=? AND i.quantity>1 ${cardId?'AND i.card_id=?':''}`, ...[userId,...(cardId?[cardId]:[])]);
  ensure(rows.length>0,'UNAVAILABLE','Aucun doublon disponible à recycler.',409);
  let amount=0,quantity=0;
  for (const row of rows) { const duplicates=row.quantity-1; removeCards(userId,row.card_id,duplicates); amount+=duplicates*row.recycle_value; quantity+=duplicates; }
  adjustBalance(userId,amount,'Recyclage de doublons');
  logActivity(userId,'recycle',`${quantity} doublons recyclés pour ${amount} Éclats.`);
  return {type:'recycle',message:`${quantity} doublons recyclés. Un exemplaire de chaque carte est conservé.`,amount,quantity};
}
