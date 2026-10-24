import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Action, ActionResult } from '../src/lib/contracts';

const dbFile=resolve(`data/test-concurrency-${process.pid}.sqlite`);
process.env.DATABASE_PATH=dbFile;
process.env.LOCAL_DEV_MODE='true';
process.env.APP_URL='http://localhost:3000';
const {getDb}=await import('../src/server/database');
const {getState,executeAction}=await import('../src/server/engine');
const db=getDb();
const run=promisify(execFile);
async function worker(userId:string,action:Action,key=randomUUID()):Promise<{ok:boolean;code?:string;result?:ActionResult}> {
  const {stdout}=await run(process.execPath,['--import','tsx','tests/helpers/concurrent-worker.ts',userId,JSON.stringify(action),key],{cwd:process.cwd(),env:{...process.env,DATABASE_PATH:dbFile},timeout:30_000});
  return JSON.parse(stdout);
}
after(()=>{db.close();for(const suffix of ['','-wal','-shm'])rmSync(dbFile+suffix,{force:true});});

test('six real processes retrying the same booster key award exactly five cards once',async()=>{
  const before=getState('fredou');
  const key=randomUUID();
  const results=await Promise.all(Array.from({length:6},()=>worker('fredou',{type:'open',boosterId:'free'},key)));
  assert.ok(results.every(r=>r.ok),JSON.stringify(results));
  assert.equal(new Set(results.map(r=>r.result?.opening?.id)).size,1);
  const afterState=getState('fredou');
  assert.equal(afterState.openings.length-before.openings.length,1);
  const count=(s:typeof before)=>s.inventory.reduce((n,i)=>n+i.quantity,0);
  assert.equal(count(afterState)-count(before),5);
});

test('two processes cannot purchase the same listing or duplicate escrow cards',async()=>{
  const created=executeAction('fredou',{type:'listing-create',cardId:'card-1',quantity:1,price:50},randomUUID());
  assert.ok(created.entityId);
  const totalCards=()=>Number((db.prepare('SELECT SUM(quantity) AS total FROM inventory').get() as {total:number}).total)+Number((db.prepare("SELECT COALESCE(SUM(quantity),0) AS total FROM listings WHERE status='active'").get() as {total:number}).total);
  const beforeTotal=totalCards();
  const results=await Promise.all(['iris','noam'].map(userId=>worker(userId,{type:'listing-buy',listingId:created.entityId!})));
  assert.equal(results.filter(r=>r.ok).length,1,JSON.stringify(results));
  assert.equal(results.filter(r=>!r.ok).length,1);
  assert.equal(totalCards(),beforeTotal);
  assert.equal(Number((db.prepare('SELECT COUNT(*) AS n FROM price_history WHERE listing_id=?').get(created.entityId) as {n:number}).n),1);
  assert.equal(Number((db.prepare('SELECT COUNT(*) AS n FROM users WHERE balance<0').get() as {n:number}).n),0);
  for(const u of getState(null).users) {
    const row=db.prepare('SELECT balance,(SELECT COALESCE(SUM(amount),0) FROM ledger WHERE user_id=users.id) AS sum FROM users WHERE id=?').get(u.id) as {balance:number;sum:number};
    assert.equal(row.balance,row.sum);
  }
});
