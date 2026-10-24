import { deletePgAccount } from '../src/server/postgres-account-delete';
/** True PostgreSQL integration test. Every write is rolled back, even on failure. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pgPool, pgRollbackTest, pgRead } from '../src/server/postgres';
import { findOrCreateDiscordPlayer, createPgSession, getPgSessionUser, revokePgSession } from '../src/server/postgres-auth';
import { openPgBooster } from '../src/server/postgres-boosters';
import { buyPgBooster } from '../src/server/postgres-booster-purchases';
import { pgListingAction } from '../src/server/postgres-listings';
import { pgBuyListing } from '../src/server/postgres-market-buy';
import { pgState } from '../src/server/postgres-state';
import { pgTradeAction } from '../src/server/postgres-trades';
import { pgRecycle } from '../src/server/postgres-recycle';
import { pgReferral } from '../src/server/postgres-referral';
import { pgSaveEvent } from '../src/server/postgres-events';

async function main() {
 if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) throw Error('URI PostgreSQL requise.');
 const testIds:string[]=[];
 const testEventIds:string[]=[];
 let testError:unknown;
 try {
  try {
   await pgRollbackTest(async()=>{
   const one=await findOrCreateDiscordPlayer({discordId:'991'+String(Date.now()).padStart(20,'0'),username:'PG Test 1',avatar:null});
   const two=await findOrCreateDiscordPlayer({discordId:'992'+String(Date.now()).padStart(20,'0'),username:'PG Test 2',avatar:null});
   testIds.push(one.id,two.id);
   const activeToken=await createPgSession(one.id);
   const toDeleteToken=await createPgSession(two.id);
   assert.equal(await getPgSessionUser(activeToken),one.id);
   assert.equal(await getPgSessionUser(toDeleteToken),two.id);
   await revokePgSession(activeToken);
   assert.equal(await getPgSessionUser(activeToken),null);
   assert.equal(await getPgSessionUser('invalid'),null);
   assert.equal(one.balance,300);
   assert.equal((await findOrCreateDiscordPlayer({discordId:one.discord_id!,username:'PG Test 1',avatar:null})).id,one.id);
   const grants=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM ledger WHERE user_id=$1 AND reason=$2',[one.id,'Bienvenue dans FREDOU COLLECTION']);
   assert.equal(grants[0].n,1,'La connexion répétée ne doit pas doubler le bonus de bienvenue');
   // A fresh user must have exactly one welcome ledger entry and all five reserves.
   const welcome=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM ledger WHERE user_id=$1',[one.id]);
   assert.equal(welcome[0].n,1);
   const reserves=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM user_boosters WHERE user_id=$1',[one.id]);
   assert.equal(reserves[0].n,5);
   const key=randomUUID();
   const opening=await openPgBooster(one.id,'free',key);
   assert.equal(opening.opening?.cards.length,5);
   assert.deepEqual(await openPgBooster(one.id,'free',key),opening);
   const inv=await pgRead<{n:number}>('SELECT COALESCE(SUM(quantity),0)::integer n FROM inventory WHERE user_id=$1',[one.id]);
   assert.equal(inv[0].n,5);
   const firstAchievement=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM user_achievements WHERE user_id=$1 AND achievement_id=$2',[one.id,'first-opening']);
   assert.equal(firstAchievement[0].n,1,'Le premier booster doit débloquer le succès');
   const firstAchievementGrants=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM ledger WHERE user_id=$1 AND reason=$2',[one.id,'Succès : Premier éclat']);
   assert.equal(firstAchievementGrants[0].n,1,'Le rejeu ne doit pas doubler la prime du succès');
   const purchase=await buyPgBooster(one.id,'premium',1,randomUUID());
   assert.equal(purchase.amount,120);
   const purchaseReplayKey=randomUUID();
   const bought=await buyPgBooster(one.id,'premium',1,purchaseReplayKey);
   assert.deepEqual(await buyPgBooster(one.id,'premium',1,purchaseReplayKey),bought);
   const spent=await pgRead<{balance:number}>('SELECT balance FROM users WHERE id=$1',[one.id]);
   const spentLedger=await pgRead<{n:number}>('SELECT COALESCE(SUM(amount),0)::integer n FROM ledger WHERE user_id=$1',[one.id]);
   assert.equal(spent[0].balance,spentLedger[0].n,'Le solde doit correspondre au journal, succès compris');
   const selected=opening.opening!.cards[0].cardId;
   const listing=await pgListingAction(one.id,{type:'listing-create',cardId:selected,quantity:1,price:10},randomUUID());
   assert.ok(listing.entityId);
   const paid=await pgBuyListing(two.id,listing.entityId!,randomUUID());
   assert.equal(paid.amount,10);
   const sold=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM price_history WHERE listing_id=$1',[listing.entityId]);
   assert.equal(sold[0].n,1);
   const owned=await pgRead<{n:number}>('SELECT quantity n FROM inventory WHERE user_id=$1 AND card_id=$2',[two.id,selected]);
   assert.equal(owned[0]?.n,1);
   // Money must be transferred exactly once in both directions.
   const buyerAfter=await pgRead<{balance:number}>('SELECT balance FROM users WHERE id=$1',[two.id]);
   const buyerLedger=await pgRead<{n:number}>('SELECT COALESCE(SUM(amount),0)::integer n FROM ledger WHERE user_id=$1',[two.id]);
   assert.equal(buyerAfter[0].balance,buyerLedger[0].n,'Achat et succès doivent être comptabilisés');
   const sellerAfter=await pgRead<{balance:number}>('SELECT balance FROM users WHERE id=$1',[one.id]);
   const sellerLedger=await pgRead<{n:number}>('SELECT COALESCE(SUM(amount),0)::integer n FROM ledger WHERE user_id=$1',[one.id]);
   assert.equal(sellerAfter[0].balance,sellerLedger[0].n,'Vente et succès doivent être comptabilisés');
   const saleLedgers=await pgRead<{user_id:string;amount:number}>('SELECT user_id,amount FROM ledger WHERE reference_id=$1 AND reason IN ($2,$3)',[listing.entityId,'Achat marché','Vente marché']);
   assert.equal(saleLedgers.length,2);
   assert.equal(saleLedgers.reduce((sum,x)=>sum+x.amount,0),0);
   assert.deepEqual(new Set(saleLedgers.map(x=>x.user_id)),new Set([one.id,two.id]));
   const marketAchievements=await pgRead<{user_id:string;n:number}>("SELECT user_id,COUNT(*)::integer n FROM user_achievements WHERE user_id=ANY($1::text[]) AND achievement_id='first-transaction' GROUP BY user_id",[[one.id,two.id]]);
   assert.equal(marketAchievements.length,2,'Acheteur et vendeur doivent débloquer le succès marché');
   assert.ok(marketAchievements.every(x=>x.n===1),'Succès marché attribué une seule fois');
   // Two distinct cards with the same recycle value make a fair direct exchange.
   const swap=await pgRead<{id:string}>(
    'SELECT id FROM cards WHERE rarity=0 AND id<>$1 ORDER BY id LIMIT 2',[selected]);
   assert.equal(swap.length,2);
   const date=new Date().toISOString();
   await pgRead('INSERT INTO inventory(user_id,card_id,quantity,favorite,first_obtained_at,last_obtained_at) VALUES($1,$2,1,0,$3,$3) ON CONFLICT(user_id,card_id) DO UPDATE SET quantity=inventory.quantity+1',
    [one.id,swap[0].id,date]);
   await pgRead('INSERT INTO inventory(user_id,card_id,quantity,favorite,first_obtained_at,last_obtained_at) VALUES($1,$2,1,0,$3,$3) ON CONFLICT(user_id,card_id) DO UPDATE SET quantity=inventory.quantity+1',
    [two.id,swap[1].id,date]);
   const trade=await pgTradeAction(one.id,{type:'trade-create',recipientId:two.id,offered:[{cardId:swap[0].id,quantity:1}],requested:[{cardId:swap[1].id,quantity:1}]},randomUUID());
   assert.ok(trade.entityId);
   const accepted=await pgTradeAction(two.id,{type:'trade-respond',tradeId:trade.entityId!,decision:'accept'},randomUUID());
   assert.equal(accepted.type,'trade-respond');
   const acceptedAgain=await pgRead<{status:string}>('SELECT status FROM trades WHERE id=$1',[trade.entityId]);
   assert.equal(acceptedAgain[0].status,'accepted');
   const traded=await pgRead<{user_id:string;card_id:string;quantity:number}>(
    'SELECT user_id,card_id,quantity FROM inventory WHERE (user_id=$1 AND card_id=$3) OR (user_id=$2 AND card_id=$4)',
    [one.id,two.id,swap[1].id,swap[0].id]);
   assert.equal(traded.length,2);
   assert.ok(traded.every(x=>x.quantity>=1));
   // Recycling preserves one copy and credits the exact recycle value.
   await pgRead('UPDATE inventory SET quantity=3 WHERE user_id=$1 AND card_id=$2',[one.id,swap[1].id]);
   const recycle=await pgRecycle(one.id,{type:'recycle',cardId:swap[1].id},randomUUID());
   assert.equal(recycle.quantity,2);
   const afterRecycling=await pgRead<{quantity:number}>('SELECT quantity FROM inventory WHERE user_id=$1 AND card_id=$2',[one.id,swap[1].id]);
   assert.equal(afterRecycling[0].quantity,1);
   const recycleAchievement=await pgRead<{n:number}>("SELECT COUNT(*)::integer n FROM user_achievements WHERE user_id=$1 AND achievement_id='first-recycle'",[one.id]);
   assert.equal(recycleAchievement[0].n,1,'Le recyclage doit débloquer son succès');
   // A referral is registered once, and subsequent attempts must not overwrite it.
   const ref=await pgRead<{referral_code:string}>('SELECT referral_code FROM users WHERE id=$1',[two.id]);
   const referral=await pgReferral(one.id,{type:'referral',code:ref[0].referral_code},randomUUID());
   assert.equal(referral.type,'referral');
   const linked=await pgRead<{referred_by:string}>('SELECT referred_by FROM users WHERE id=$1',[one.id]);
   assert.equal(linked[0].referred_by,two.id);
   // Referral payouts occur only after three openings and are never duplicated.
   const payoutsBefore=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM referral_rewards WHERE referred_id=$1',[one.id]);
   assert.equal(payoutsBefore[0].n,0);
   await openPgBooster(one.id,'free',randomUUID());
   await openPgBooster(one.id,'free',randomUUID());
   const payouts=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM referral_rewards WHERE referred_id=$1',[one.id]);
   assert.equal(payouts[0].n,1);
   const gifts=await pgRead<{user_id:string;amount:number}>('SELECT user_id,amount FROM ledger WHERE reference_id=$1 AND reason=$2',[one.id,'Parrainage confirmé']);
   assert.equal(gifts.length,2);
   assert.ok(gifts.every(x=>x.amount===100));
   const rewardedOnce=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM referral_rewards WHERE referred_id=$1',[one.id]);
   assert.equal(rewardedOnce[0].n,1);
   // Extra premium opening must never grant the referral payout a second time.
   await openPgBooster(one.id,'premium',randomUUID());
   const giftsAfterReplay=await pgRead<{user_id:string;amount:number}>('SELECT user_id,amount FROM ledger WHERE reference_id=$1 AND reason=$2',[one.id,'Parrainage confirmé']);
   assert.equal(giftsAfterReplay.length,2);
   assert.deepEqual(new Set(giftsAfterReplay.map(x=>x.user_id)),new Set([one.id,two.id]));

   // Late referral: three prior openings must grant exactly one award at registration.
   const late=await findOrCreateDiscordPlayer({discordId:'993'+randomUUID().replaceAll('-','').slice(0,22),username:'PG Test Late',avatar:null});
   testIds.push(late.id);
   for(let i=0;i<3;i++) await openPgBooster(late.id,'free',randomUUID());
   const lateReferral=await pgReferral(late.id,{type:'referral',code:ref[0].referral_code},randomUUID());
   assert.equal(lateReferral.type,'referral');
   const lateRewards=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM referral_rewards WHERE referred_id=$1',[late.id]);
   assert.equal(lateRewards[0].n,1);
   const lateLedger=await pgRead<{user_id:string;amount:number}>(
    'SELECT user_id,amount FROM ledger WHERE reference_id=$1 AND reason=$2',[late.id,'Parrainage confirmé']);
   assert.equal(lateLedger.length,2);
   assert.ok(lateLedger.every(x=>x.amount===100));
   // Admin-only event actions must not be available to a regular player.
   await assert.rejects(pgSaveEvent(one.id,{type:'event-save',name:'Test',description:'Test',startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+86400000).toISOString(),active:false,color:'#000000',reward:0},randomUUID()));
   // Positive admin path: temporary event is rolled back with the rest of this suite.
   await pgRead("UPDATE users SET role='admin' WHERE id=$1",[one.id]);
   const eventAction={type:'event-save' as const,name:'Intégration temporaire',description:'test',startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+86400000).toISOString(),active:false,color:'#224466',reward:25};
   const eventSaved=await pgSaveEvent(one.id,eventAction,randomUUID());
   assert.ok(eventSaved.entityId);
   testEventIds.push(eventSaved.entityId!);
   const eventRow=await pgRead<{name:string}>('SELECT name FROM events WHERE id=$1',[eventSaved.entityId]);
   assert.equal(eventRow[0].name,eventAction.name);
   const state=await pgState(one.id);
   assert.equal(state.currentUser?.id,one.id);
   assert.ok(state.openings.length>0);
   // Deleting an account must cancel outstanding listings, not leave buyable orphaned offers.
   const pendingSale=await pgListingAction(two.id,{type:'listing-create',cardId:selected,quantity:1,price:12},randomUUID());
   assert.ok(pendingSale.entityId);
   const removed=await deletePgAccount(two.id,'PG Test 2');
   assert.equal(removed.type,'account-delete');
   const vanished=await pgRead<{id:string}>('SELECT id FROM users WHERE id=$1',[two.id]);
   assert.equal(vanished.length,0);
   assert.equal(await getPgSessionUser(toDeleteToken),null,'Suppression doit révoquer toutes les sessions');
   const canceled=await pgRead<{status:string;seller_id:string|null}>('SELECT status,seller_id FROM listings WHERE id=$1',[pendingSale.entityId]);
   assert.equal(canceled[0]?.status,'cancelled');
   assert.equal(canceled[0]?.seller_id,null);
   console.log('PG WRITE OK : comptes, ouverture/rejeu, achat booster, marché, échange, inventaire, état joueur.');
  });
  } catch (error) { testError=error; }
  const remaining=await pgRead<{id:string}>('SELECT id FROM users WHERE id=ANY($1::text[])',[testIds]);
  assert.equal(remaining.length,0,'Rollback incomplet : comptes temporaires présents');
  if (testIds.length) {
   const dependencies=await pgRead<{table_name:string;n:number}>(`SELECT 'inventory' table_name,COUNT(*)::integer n FROM inventory WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'ledger',COUNT(*)::integer FROM ledger WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'openings',COUNT(*)::integer FROM openings WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'listings',COUNT(*)::integer FROM listings WHERE seller_id=ANY($1::text[]) OR buyer_id=ANY($1::text[])
     UNION ALL SELECT 'trades',COUNT(*)::integer FROM trades WHERE sender_id=ANY($1::text[]) OR recipient_id=ANY($1::text[])
     UNION ALL SELECT 'idempotency',COUNT(*)::integer FROM idempotency WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'acquisitions',COUNT(*)::integer FROM acquisitions WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'sessions',COUNT(*)::integer FROM sessions WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'activities',COUNT(*)::integer FROM activities WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'user_achievements',COUNT(*)::integer FROM user_achievements WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'user_boosters',COUNT(*)::integer FROM user_boosters WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'referral_rewards',COUNT(*)::integer FROM referral_rewards WHERE referred_id=ANY($1::text[]) OR referrer_id=ANY($1::text[])
     UNION ALL SELECT 'event_rewards',COUNT(*)::integer FROM event_rewards WHERE user_id=ANY($1::text[])
     UNION ALL SELECT 'price_history',COUNT(*)::integer FROM price_history ph JOIN listings l ON ph.listing_id=l.id WHERE l.seller_id=ANY($1::text[]) OR l.buyer_id=ANY($1::text[])`,[testIds]);
   assert.ok(dependencies.every(x=>x.n===0),'Rollback incomplet : lignes de jeu temporaires conservées');
  }
  if (testEventIds.length) {
   const leftoverEvents=await pgRead<{id:string}>('SELECT id FROM events WHERE id=ANY($1::text[])',[testEventIds]);
   assert.equal(leftoverEvents.length,0,'Rollback incomplet : événement de test conservé');
  }
  console.log('ROLLBACK OK : aucun compte, inventaire, achat, annonce ni échange de test conservé.');
  if(testError) throw testError;
 } finally {await pgPool().end();}
}
main().catch(err=>{console.error('PG WRITE KO : '+(err instanceof Error?err.message:String(err)));process.exitCode=1;});
