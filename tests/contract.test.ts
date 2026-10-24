import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

interface Schema {
  $ref?: string; type?: string; const?: unknown; enum?: unknown[]; anyOf?: Schema[]; oneOf?: Schema[];
  properties?: Record<string,Schema>; required?: string[]; additionalProperties?: boolean | Schema;
  items?: Schema; minItems?: number; maxItems?: number; minimum?: number; maximum?: number;
  minLength?: number; maxLength?: number; pattern?: string; format?: string;
}
const api = JSON.parse(readFileSync(resolve('docs/api/openapi.json'), 'utf8')) as { components: { schemas: Record<string,Schema> } };
function validate(value: unknown, schema: Schema, path = '$'): void {
  if (schema.$ref) {
    const target = api.components.schemas[schema.$ref.split('/').at(-1)!];
    assert.ok(target, `${path}: unresolved ${schema.$ref}`);
    return validate(value,target,path);
  }
  const choices = schema.oneOf || schema.anyOf;
  if (choices) {
    const matches = choices.filter(choice => { try { validate(value,choice,path); return true; } catch { return false; } }).length;
    assert.ok(schema.oneOf ? matches === 1 : matches >= 1, `${path}: no matching union (${matches})`);
    return;
  }
  if ('const' in schema) assert.deepEqual(value,schema.const,`${path}: const`);
  if (schema.enum) assert.ok(schema.enum.includes(value), `${path}: enum`);
  if (schema.type === 'null') assert.equal(value,null,`${path}: null`);
  if (schema.type === 'boolean') assert.equal(typeof value,'boolean',`${path}: boolean`);
  if (schema.type === 'string') {
    assert.equal(typeof value,'string',`${path}: string`);
    const text = value as string;
    if (schema.minLength !== undefined) assert.ok(text.length >= schema.minLength, `${path}: minLength`);
    if (schema.maxLength !== undefined) assert.ok(text.length <= schema.maxLength, `${path}: maxLength`);
    if (schema.pattern) assert.match(text,new RegExp(schema.pattern),`${path}: pattern`);
    if (schema.format === 'date-time') assert.ok(Number.isFinite(Date.parse(text)) && /^\d{4}-\d{2}-\d{2}T/.test(text), `${path}: date-time`);
  }
  if (schema.type === 'number' || schema.type === 'integer') {
    assert.equal(typeof value,'number',`${path}: number`);
    const n=value as number;
    assert.ok(Number.isFinite(n),`${path}: finite`);
    if (schema.type === 'integer') assert.ok(Number.isInteger(n),`${path}: integer`);
    if (schema.minimum !== undefined) assert.ok(n >= schema.minimum,`${path}: minimum`);
    if (schema.maximum !== undefined) assert.ok(n <= schema.maximum,`${path}: maximum`);
  }
  if (schema.type === 'array') {
    assert.ok(Array.isArray(value),`${path}: array`);
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems,`${path}: minItems`);
    if (schema.maxItems !== undefined) assert.ok(value.length <= schema.maxItems,`${path}: maxItems`);
    if (schema.items) value.forEach((item,i)=>validate(item,schema.items!,`${path}[${i}]`));
  }
  if (schema.type === 'object') {
    assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value),`${path}: object`);
    const record=value as Record<string,unknown>;
    for (const key of schema.required || []) assert.ok(Object.hasOwn(record,key),`${path}.${key}: required`);
    for (const [key,item] of Object.entries(record)) {
      const property=schema.properties?.[key];
      if (property) validate(item,property,`${path}.${key}`);
      else if (schema.additionalProperties === false) assert.fail(`${path}.${key}: unexpected`);
      else if (typeof schema.additionalProperties === 'object') validate(item,schema.additionalProperties,`${path}.${key}`);
    }
  }
}
const databasePath=resolve('data',`test-contract-${process.pid}.sqlite`);
const prior=Object.fromEntries(['DATABASE_PATH','APP_URL','LOCAL_DEV_MODE','DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET'].map(key=>[key,process.env[key]]));
let db: DatabaseSync;
let actions: typeof import('../src/app/api/actions/route');
let state: typeof import('../src/app/api/state/route');
let oauth: typeof import('../src/app/api/auth/discord/route');
let callback: typeof import('../src/app/api/auth/discord/callback/route');
let session: string;
before(async()=>{
  process.env.DATABASE_PATH=databasePath; process.env.APP_URL='http://localhost:3000'; process.env.LOCAL_DEV_MODE='true';
  delete process.env.DISCORD_CLIENT_ID; delete process.env.DISCORD_CLIENT_SECRET;
  const database=await import('../src/server/database'); db=database.getDb();
  actions=await import('../src/app/api/actions/route'); state=await import('../src/app/api/state/route');
  oauth=await import('../src/app/api/auth/discord/route'); callback=await import('../src/app/api/auth/discord/callback/route');
});
after(()=>{
  db?.close(); assert.equal(dirname(databasePath),resolve('data')); assert.match(basename(databasePath),/^test-contract-\d+\.sqlite$/);
  for(const suffix of ['', '-wal', '-shm'])rmSync(databasePath+suffix,{force:true});
  for(const [key,value] of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
function mutation(body: unknown, cookie?:string) {
  return new Request('http://localhost:3000/api/actions',{method:'POST',headers:{origin:'http://localhost:3000',host:'localhost:3000','content-type':'application/json','Idempotency-Key':randomUUID(),...(cookie?{cookie}:{})},body:JSON.stringify(body)});
}

test('GET state guest and authenticated responses satisfy the published DTO including nested types',async()=>{
  const guest=await state.GET(new Request('http://localhost:3000/api/state'));
  assert.equal(guest.status,200); assert.equal(guest.headers.get('cache-control'),'no-store');
  const guestBody=await guest.json(); validate(guestBody,api.components.schemas.StateResponse);
  assert.equal(guestBody.currentUser,null); assert.deepEqual(guestBody.inventory,[]);
  const login=await actions.POST(mutation({type:'login-dev',userId:'fredou'}));
  assert.equal(login.status,200); validate(await login.json(),api.components.schemas.ActionResponse);
  session=login.headers.get('set-cookie')!.split(';')[0];
  const signedIn=await state.GET(new Request('http://localhost:3000/api/state',{headers:{cookie:session}}));
  const body=await signedIn.json(); validate(body,api.components.schemas.StateResponse);
  assert.equal(body.currentUser.id,'fredou'); assert.ok(body.inventory.length>0);
  assert.throws(()=>validate({...body,unknownSecret:'must reject'},api.components.schemas.StateResponse));
});

test('POST opening response matches the schema and contains exactly five server rewards',async()=>{
  const response=await actions.POST(mutation({type:'open',boosterId:'free'},session));
  assert.equal(response.status,200);
  const body=await response.json(); validate(body,api.components.schemas.ActionResponse);
  assert.equal(body.result.opening.cards.length,5);
});

test('HTTP validation errors follow ErrorResponse and do not accept extra action fields',async()=>{
  const response=await actions.POST(mutation({type:'preferences',reducedMotion:false,unexpected:true},session));
  assert.equal(response.status,422); validate(await response.json(),api.components.schemas.ErrorResponse);
});

test('both Discord endpoints return the documented unavailable error without real credentials',async()=>{
  const start=await oauth.GET(); assert.equal(start.status,503); validate(await start.json(),api.components.schemas.ErrorResponse);
  const end=await callback.GET(new Request('http://localhost:3000/api/auth/discord/callback'));
  assert.equal(end.status,503); validate(await end.json(),api.components.schemas.ErrorResponse);
});

test('all OpenAPI schema references resolve',()=>{
  let count=0;
  function visit(value:unknown):void {
    if(!value || typeof value!=='object')return;
    const record=value as Record<string,unknown>;
    if(typeof record.$ref==='string'){assert.ok(api.components.schemas[record.$ref.split('/').at(-1)!],record.$ref);count++;}
    Object.values(record).forEach(visit);
  }
  visit(api); assert.ok(count>50);
});
