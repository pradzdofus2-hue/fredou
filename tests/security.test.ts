import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrigin, validateIdempotencyKey, readJsonBody, isLocalDevelopment } from '../src/server/http';

test('same-origin mutations accept the configured local origin', () => {
  const req = new Request('http://localhost:3000/api/actions', {method:'POST', headers:{origin:'http://localhost:3000',host:'localhost:3000'}});
  assert.doesNotThrow(() => validateOrigin(req));
});
test('foreign or missing origins and rebinding hostnames are rejected', () => {
  for (const origin of ['https://evil.example', 'null', 'http://localhost:3001', '']) {
    assert.throws(() => validateOrigin(new Request('http://localhost:3000/api/actions', {method:'POST', headers:{origin,host:'localhost:3000'}})));
  }
  assert.throws(() => validateOrigin(new Request('http://evil.example:3000/api/actions', {method:'POST',headers:{origin:'http://evil.example:3000',host:'evil.example:3000'}})));
});
test('idempotency keys must be UUIDs', () => {
  assert.equal(validateIdempotencyKey('e8add155-f02e-4370-aa0a-06ca05f66b2b'),'e8add155-f02e-4370-aa0a-06ca05f66b2b');
  for(const key of [null,'','hello','x'.repeat(300)]) assert.throws(() => validateIdempotencyKey(key));
});
test('JSON parsing rejects oversized and malformed bodies', async () => {
  await assert.rejects(readJsonBody(new Request('http://localhost', {method:'POST', headers:{'content-type':'application/json'},body:'x'.repeat(33_000)})));
  await assert.rejects(readJsonBody(new Request('http://localhost', {method:'POST', headers:{'content-type':'application/json'},body:'{'})));
  assert.deepEqual(await readJsonBody(new Request('http://localhost', {method:'POST',headers:{'content-type':'application/json'},body:'{"type":"logout"}'})),{type:'logout'});
});
test('local demo selection cannot activate on a public origin, even when explicitly requested',()=>{
  const prior={url:process.env.APP_URL,dev:process.env.LOCAL_DEV_MODE,id:process.env.DISCORD_CLIENT_ID};
  try {
    process.env.APP_URL='https://public.example'; delete process.env.DISCORD_CLIENT_ID; delete process.env.LOCAL_DEV_MODE;
    assert.equal(isLocalDevelopment(),false);
    process.env.LOCAL_DEV_MODE='true'; assert.equal(isLocalDevelopment(),false);
    process.env.APP_URL='http://localhost:3000'; assert.equal(isLocalDevelopment(),true);
    process.env.LOCAL_DEV_MODE='false'; assert.equal(isLocalDevelopment(),false);
    delete process.env.LOCAL_DEV_MODE; process.env.DISCORD_CLIENT_ID='123'; assert.equal(isLocalDevelopment(),false);
  } finally {
    for(const [key,value] of Object.entries({APP_URL:prior.url,LOCAL_DEV_MODE:prior.dev,DISCORD_CLIENT_ID:prior.id})) {
      if(value===undefined) delete process.env[key]; else process.env[key]=value;
    }
  }
});
