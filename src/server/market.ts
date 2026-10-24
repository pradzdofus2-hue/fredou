import type { ActionResult, Listing } from '../lib/contracts';
import { getDb, id, now, one } from './database';
import { acquire, adjustBalance, logActivity, removeCards } from './economy';
import { ensure } from './errors';
import { evaluateAchievements } from './achievements';
interface ListingRow { id:string;seller_id:string|null;card_id:string;quantity:number;price:number;status:Listing['status'];buyer_id:string|null;created_at:string;completed_at:string|null; }
export function createListing(userId:string,cardId:string,quantity:number,price:number):ActionResult {
  ensure(one('SELECT 1 FROM cards WHERE id=?',cardId),'NOT_FOUND','Carte introuvable.',404);
  ensure(one<{count:number}>("SELECT COUNT(*) count FROM listings WHERE seller_id=? AND status='active'",userId)!.count<100,'CONFLICT','Vous pouvez publier au maximum cent annonces actives.',409);
  removeCards(userId,cardId,quantity);
  const listingId=id();
  getDb().prepare("INSERT INTO listings VALUES(?,?,?,?,?,'active',NULL,?,NULL)").run(listingId,userId,cardId,quantity,price,now());
  logActivity(userId,'listing',`${quantity} carte(s) placée(s) en vente à ${price} Éclats par exemplaire.`);
  return {type:'listing-create',message:'Annonce publiée. Les exemplaires sont réservés jusqu’à la vente ou l’annulation.',entityId:listingId};
}
export function buyListing(userId:string,listingId:string):ActionResult {
  const listing=one<ListingRow>('SELECT * FROM listings WHERE id=?',listingId);
  ensure(listing,'NOT_FOUND','Annonce introuvable.',404);
  ensure(listing.status==='active'&&listing.seller_id,'CONFLICT','Cette annonce n’est plus disponible.',409);
  ensure(listing.seller_id!==userId,'FORBIDDEN','Vous ne pouvez pas acheter votre propre annonce.',403);
  const amount=listing.price*listing.quantity;
  adjustBalance(userId,-amount,'Achat sur le marché',listingId);
  adjustBalance(listing.seller_id,amount,'Vente sur le marché',listingId);
  acquire(userId,listing.card_id,listing.quantity,'marché',listingId);
  const date=now();
  getDb().prepare("UPDATE listings SET status='sold',buyer_id=?,completed_at=? WHERE id=? AND status='active'").run(userId,date,listingId);
  getDb().prepare('INSERT INTO price_history VALUES(?,?,?,?,?,?)').run(id(),listingId,listing.card_id,listing.price,listing.quantity,date);
  logActivity(userId,'market',`Achat de ${listing.quantity} carte(s) pour ${amount} Éclats.`);
  logActivity(listing.seller_id,'market',`Vente de ${listing.quantity} carte(s) pour ${amount} Éclats.`);
  evaluateAchievements(listing.seller_id);
  return {type:'listing-buy',message:'Achat réussi. Les cartes ont rejoint votre collection.',amount,quantity:listing.quantity,entityId:listingId};
}
export function cancelListing(userId:string,listingId:string):ActionResult {
  const listing=one<ListingRow>('SELECT * FROM listings WHERE id=?',listingId);
  ensure(listing,'NOT_FOUND','Annonce introuvable.',404);
  ensure(listing.seller_id===userId,'FORBIDDEN','Cette annonce ne vous appartient pas.',403);
  ensure(listing.status==='active','CONFLICT','Cette annonce n’est plus active.',409);
  acquire(userId,listing.card_id,listing.quantity,'annulation de vente',listingId);
  getDb().prepare("UPDATE listings SET status='cancelled',completed_at=? WHERE id=?").run(now(),listingId);
  return {type:'listing-cancel',message:'Annonce annulée et cartes rendues à votre collection.',entityId:listingId};
}
