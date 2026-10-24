/** Real parallel connections against an ephemeral CI-only PostgreSQL instance. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pgPool,pgRead} from '../src/server/postgres';
import {findOrCreateDiscordPlayer,createPgSession,getPgSessionUser,revokePgSession} from '../src/server/postgres-auth';
import {openPgBooster} from '../src/server/postgres-boosters';

async function main(){
 const url=new URL(process.env.DATABASE_URL||'');
 if(process.env.FREDOU_EPHEMERAL_PG_CI!=='true' ||
    !['localhost','127.0.0.1','::1'].includes(url.hostname) ||
    url.pathname!=='/fredou_ci')throw Error('Only the isolated local CI database may run this test');
 let userId:string|undefined;
 try{
  const user=await findOrCreateDiscordPlayer({discordId:'995'+randomUUID().replaceAll('-','').slice(0,22),username:'CI Concurrent User',avatar:null});
  userId=user.id;
  const key=randomUUID();
  const results=await Promise.all(Array.from({length:8},()=>openPgBooster(user.id,'free',key)));
  assert.equal(new Set(results.map(x=>x.opening?.id)).size,1,'All concurrent replays must share the opening');
  assert.ok(results.every(x=>x.opening?.cards.length===5));
  const openings=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM openings WHERE user_id=$1',[user.id]);
  assert.equal(openings[0].n,1,'Concurrent requests must create one opening');
  const inventory=await pgRead<{n:number}>('SELECT COALESCE(SUM(quantity),0)::integer n FROM inventory WHERE user_id=$1',[user.id]);
  assert.equal(inventory[0].n,5,'Exactly five cards must be granted');
  const rewards=await pgRead<{n:number}>("SELECT COUNT(*)::integer n FROM user_achievements WHERE user_id=$1 AND achievement_id='first-opening'",[user.id]);
  assert.equal(rewards[0].n,1,'First-opening reward must be claimed once');
  const idempotency=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM idempotency WHERE user_id=$1 AND key=$2',[user.id,key]);
  assert.equal(idempotency[0].n,1,'One response must be stored for the request key');
  console.log('PG CONCURRENCY OK: 8 parallel requests, 1 opening, 5 cards, one reward and receipt');
  // A burst of real Discord OAuth callbacks for the same identity must not mint welcome credit.
  const discordId='994'+randomUUID().replaceAll('-','').slice(0,22);
  const concurrent=await Promise.all(Array.from({length:8},(_,i)=>findOrCreateDiscordPlayer({
   discordId,username:'CI OAuth '+i,avatar:null
  })));
  const secondId=concurrent[0].id;
  assert.equal(new Set(concurrent.map(x=>x.id)).size,1,'One Discord ID must produce one player');
  const welcome=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM ledger WHERE user_id=$1',[secondId]);
  assert.equal(welcome[0].n,1,'Welcome shards may be credited only once');
  const stock=await pgRead<{n:number}>('SELECT COUNT(*)::integer n FROM user_boosters WHERE user_id=$1',[secondId]);
  assert.equal(stock[0].n,5,'Starter boosters must not be duplicated');
  const session=await createPgSession(secondId);
  assert.equal(await getPgSessionUser(session),secondId,'Fresh Discord session must resolve correctly');
  await revokePgSession(session);
  assert.equal(await getPgSessionUser(session),null,'Revoked Discord session must be invalid');
  await pgRead('DELETE FROM users WHERE id=$1',[secondId]);
  console.log('PG OAUTH CONCURRENCY OK: 8 callbacks, one player, one welcome grant, 5 boosters, session revocation');

 }finally{
  if(userId)await pgRead('DELETE FROM users WHERE id=$1',[userId]);
  await pgPool().end();
 }
}
main().catch(e=>{console.error('PG CONCURRENCY KO: '+(e instanceof Error?e.message:String(e)));process.exitCode=1;});
