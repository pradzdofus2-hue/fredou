import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateDeploymentConfig} from '../src/server/deployment-config';

const valid={
 APP_URL:'https://fredou.example',
 DATABASE_URL:'postgresql://release:strong-test-credential@pool.example.com:5432/postgres?sslmode=require',
 DISCORD_CLIENT_ID:'test-app-id',
 DISCORD_CLIENT_SECRET:'test-secret',
 DISCORD_REDIRECT_URI:'https://fredou.example/api/auth/discord/callback',
 PG_AUTH_ENABLED:'true',PG_STATE_ENABLED:'true',PG_GAME_ACTIONS_ENABLED:'true',
 LOCAL_DEV_MODE:'false'
};
test('production configuration accepts the fully specified secure deployment',()=>{
 assert.deepEqual(validateDeploymentConfig(valid),[]);
});
test('deployment rejects missing server auth and database flags',()=>{
 const invalid={...valid,PG_STATE_ENABLED:'false',DISCORD_CLIENT_SECRET:''};
 const errors=validateDeploymentConfig(invalid);
 assert.ok(errors.some(x=>x.includes('PG_STATE_ENABLED')));
 assert.ok(errors.some(x=>x.includes('DISCORD_CLIENT_SECRET')));
});
test('deployment rejects non-HTTPS and malformed application origins',()=>{
 for(const url of ['http://fredou.example','https://localhost:3000','https://fredou.example/path',
  'https://user:password@fredou.example','https://fredou.example/?private=yes']){
  assert.ok(validateDeploymentConfig({...valid,APP_URL:url}).some(x=>x.includes('APP_URL')),url);
 }
});
test('deployment rejects invalid or local PostgreSQL connection strings',()=>{
 for(const url of ['file:./data/game.sqlite','postgresql://user@host.example/db',
 'postgresql://user:password@localhost:5432/game','postgresql://user:[YOUR-PASSWORD]@host.example/db']){
  assert.ok(validateDeploymentConfig({...valid,DATABASE_URL:url}).some(x=>x.includes('DATABASE_URL')),url);
 }
});
test('deployment rejects wrong Discord callback and local demo mode',()=>{
 assert.ok(validateDeploymentConfig({...valid,DISCORD_REDIRECT_URI:'https://wrong.example/api/auth/discord/callback'}).some(x=>x.includes('DISCORD_REDIRECT_URI')));
 assert.ok(validateDeploymentConfig({...valid,LOCAL_DEV_MODE:'true'}).some(x=>x.includes('LOCAL_DEV_MODE')));
});
test('configuration errors never include credential strings',()=>{
 const errors=validateDeploymentConfig({...valid,DATABASE_URL:'postgresql://admin:ultra-private@localhost/db',DISCORD_CLIENT_SECRET:''});
 assert.ok(!JSON.stringify(errors).includes('ultra-private'));
});
