import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hostedDatabaseUnavailable} from '../src/server/hosted-runtime';

test('Vercel preview and production never silently use SQLite',()=>{
 const names=['VERCEL_ENV','PG_AUTH_ENABLED','PG_STATE_ENABLED','PG_GAME_ACTIONS_ENABLED','DATABASE_URL','SUPABASE_DB_URL'] as const;
 const previous=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try{
  for(const env of ['production','preview']){
   process.env.VERCEL_ENV=env;
   for(const flag of names.slice(1,4))process.env[flag]='true';
   process.env.DATABASE_URL='postgresql://placeholder:placeholder@db.example.com/game';
   delete process.env.SUPABASE_DB_URL;
   assert.equal(hostedDatabaseUnavailable(),false);
   for(const missing of names.slice(1,4)){
    process.env[missing]='false';
    assert.equal(hostedDatabaseUnavailable(),true,env+' must fail closed without '+missing);
    delete process.env[missing];
    assert.equal(hostedDatabaseUnavailable(),true,env+' must fail closed when '+missing+' is absent');
    process.env[missing]='true';
   }
   delete process.env.DATABASE_URL;
   assert.equal(hostedDatabaseUnavailable(),true,env+' must reject a missing database URI');
   process.env.SUPABASE_DB_URL='postgresql://placeholder:placeholder@db.example.com/game';
   assert.equal(hostedDatabaseUnavailable(),false,env+' must support Supabase DB URI fallback');
   delete process.env.SUPABASE_DB_URL;
  }
  process.env.VERCEL_ENV='development';
  for(const flag of names.slice(1))delete process.env[flag];
  assert.equal(hostedDatabaseUnavailable(),false,'Local development keeps SQLite');
 }finally{
  for(const key of names){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
 }
});
