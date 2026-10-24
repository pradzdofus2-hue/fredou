/** True PostgreSQL integration test. Every write is rolled back, even on failure. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pgPool, pgRollbackTest, pgRead } from '../src/server/postgres';
import { findOrCreateDiscordPlayer } from '../src/server/postgres-auth';
import { openPgBooster } from '../src/server/postgres-boosters';
import { buyPgBooster } from '../src/server/postgres-booster-purchases';
import { pgListingAction } from '../src/server/postgres-listings';
import { pgBuyListing } from '../src/server/postgres-market-buy';
import { pgState } from '../src/server/postgres-state';
import { pgTradeAction } from '../src/server/postgres-trades';

async function main() {
 if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) throw Error('URI PostgreSQL requise.');
 const testIds:string[]=[];
 let testError:unknown;
 try {
  try {
   await pgRollbackTest(async()=>{
   const one=await findOrCreateDiscordPlayer({discordId:'991'+String(Date.now()).padStart(20,'0'),username:'PG Test 1',avatar:null});
   const two=await findOrCreateDiscordPlayer({discordId:'992'+String(Date.now()).padStart(20,'0'),username:'PG Test 2',avatar:null});
   testIds.push(one.id,two.id);
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
   const purchase=await buyPgBooster(one.id,'premium',1,randomUUID());
   assert.equal(purchase.amount,120);
   const purchaseReplayKey=randomUUID();
   const bought=await buyPgBooster(one.id,'premium',1,purchaseReplayKey);
   assert.deepEqual(await buyPgBooster(one.id,'premium',1,purchaseReplayKey),bought);
   const spent=await pgRead<{balance:number}>('SELECT balance FROM users WHERE id=$1',[one.id]);
   assert.equal(spent[0].balance,300+5-240);
   const selected=opening.opening!.cards[0].cardId;
   const listing=await pgListingAction(one.id,{type:'listing-create',cardId:selected,quantity:1,price:10},randomUUID());
   assert.ok(listing.entityId);
   const paid=await pgBuyListing(two.id,listing.entityId!,randomUUID());
   assert.equal(paid.amount,10);
   const sold=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM price_history WHERE listing_id=$1',[listing.entityId]);
   assert.equal(sold[0].n,1);
   const owned=await pgRead<{n:number}>('SELECT quantity n FROM inventory WHERE user_id=$1 AND card_id=$2',[two.id,selected]);
   assert.equal(owned[0]?.n,1);
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
   const state=await pgState(one.id);
   assert.equal(state.currentUser?.id,one.id);
   assert.ok(state.openings.length>0);
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
     UNION ALL SELECT 'acquisitions',COUNT(*)::integer FROM acquisitions WHERE user_id=ANY($1::text[])`,[testIds]);
   assert.ok(dependencies.every(x=>x.n===0),'Rollback incomplet : lignes de jeu temporaires conservées');
  }
  console.log('ROLLBACK OK : aucun compte, inventaire, achat, annonce ni échange de test conservé.');
  if(testError) throw testError;
 } finally {await pgPool().end();}
}
main().catch(err=>{console.error('PG WRITE KO : '+(err instanceof Error?err.message:String(err)));process.exitCode=1;});
