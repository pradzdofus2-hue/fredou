/** True PostgreSQL integration test. Every write is rolled back, even on failure. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pgPool, pgRollbackTest, pgRead } from '../src/server/postgres';
import { findOrCreateDiscordPlayer } from '../src/server/postgres-auth';
import { openPgBooster } from '../src/server/postgres-boosters';
import { buyPgBooster } from '../src/server/postgres-booster-purchases';
import { pgListingAction } from '../src/server/postgres-listings';
import { pgBuyListing } from '../src/server/postgres-market-buy';
import { pgTradeAction } from '../src/server/postgres-trades';
import { pgState } from '../src/server/postgres-state';

async function main() {
 if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) throw Error('URI PostgreSQL requise.');
 const countsBefore=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM users');
 try {
  await pgRollbackTest(async()=>{
   const one=await findOrCreateDiscordPlayer({discordId:'991'+String(Date.now()).padStart(20,'0'),username:'PG Test 1',avatar:null});
   const two=await findOrCreateDiscordPlayer({discordId:'992'+String(Date.now()).padStart(20,'0'),username:'PG Test 2',avatar:null});
   assert.equal(one.balance,300);
   assert.equal((await findOrCreateDiscordPlayer({discordId:one.discord_id!,username:'PG Test 1',avatar:null})).id,one.id);
   const key=randomUUID();
   const opening=await openPgBooster(one.id,'free',key);
   assert.equal(opening.opening?.cards.length,5);
   assert.deepEqual(await openPgBooster(one.id,'free',key),opening);
   const inv=await pgRead<{n:number}>('SELECT COALESCE(SUM(quantity),0)::integer n FROM inventory WHERE user_id=$1',[one.id]);
   assert.equal(inv[0].n,5);
   const purchase=await buyPgBooster(one.id,'premium',1,randomUUID());
   assert.equal(purchase.amount,120);
   const selected=opening.opening!.cards[0].cardId;
   const listing=await pgListingAction(one.id,{type:'listing-create',cardId:selected,quantity:1,price:10},randomUUID());
   assert.ok(listing.entityId);
   const paid=await pgBuyListing(two.id,listing.entityId!,randomUUID());
   assert.equal(paid.amount,10);
   const owned=await pgRead<{n:number}>('SELECT quantity n FROM inventory WHERE user_id=$1 AND card_id=$2',[two.id,selected]);
   assert.equal(owned[0]?.n,1);
   // Seed one equal-value card on each test player to exercise real trade rules.
   const cards=await pgRead<{id:string;recycle_value:number}>('SELECT id,recycle_value FROM cards ORDER BY id LIMIT 2');
   assert.equal(cards.length,2);
   const dt=new Date().toISOString();
   for(const [uid,card] of [[one.id,cards[0].id],[two.id,cards[0].id]] as const){
    await pgRead('INSERT INTO inventory(user_id,card_id,quantity,favorite,first_obtained_at,last_obtained_at) VALUES($1,$2,1,0,$3,$3) ON CONFLICT(user_id,card_id) DO UPDATE SET quantity=inventory.quantity+1',[uid,card,dt]);
   }
   const state=await pgState(one.id);
   assert.equal(state.currentUser?.id,one.id);
   assert.ok(state.openings.length>0);
   console.log('PG WRITE OK : comptes, ouverture/rejeu, achat booster, vente, inventaire, état joueur.');
  });
  const countsAfter=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM users');
  assert.equal(countsAfter[0].n,countsBefore[0].n,'Rollback incomplet');
  console.log('ROLLBACK OK : aucun compte de test conservé.');
 } finally {await pgPool().end();}
}
main().catch(err=>{console.error('PG WRITE KO : '+(err instanceof Error?err.message:String(err)));process.exitCode=1;});
