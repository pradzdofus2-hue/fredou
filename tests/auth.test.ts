import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve, dirname, basename } from 'node:path';
import { rmSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';

const testPath = resolve('data', `test-auth-${process.pid}.sqlite`);
const previous = Object.fromEntries(['DATABASE_PATH','APP_URL','LOCAL_DEV_MODE','DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET'].map(key => [key, process.env[key]]));
let auth: typeof import('../src/server/auth');
let database: typeof import('../src/server/database');
let db: DatabaseSync;

before(async () => {
  process.env.DATABASE_PATH = testPath;
  process.env.APP_URL = 'http://localhost:3000';
  process.env.LOCAL_DEV_MODE = 'true';
  delete process.env.DISCORD_CLIENT_ID;
  delete process.env.DISCORD_CLIENT_SECRET;
  database = await import('../src/server/database');
  auth = await import('../src/server/auth');
  db = database.getDb();
});
after(() => {
  db?.close();
  assert.equal(dirname(testPath), resolve('data'));
  assert.match(basename(testPath), /^test-auth-\d+\.sqlite$/);
  for (const suffix of ['', '-wal', '-shm']) rmSync(testPath + suffix, { force: true });
  for (const [key,value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

function request(setCookie?: string): Request {
  return new Request('http://localhost:3000/api/actions', { method: 'POST', headers: setCookie ? { cookie: setCookie.split(';')[0] } : {} });
}
function login(userId = 'fredou', key = randomUUID()) {
  return auth.performAuthAction(request(), { type: 'login-dev', userId }, key);
}
function hasCode(code: string) { return (error: unknown) => error instanceof Error && 'code' in error && error.code === code; }

test('sessions use HttpOnly cookies and persist only the token hash', () => {
  const receipt = login();
  assert.match(receipt.setCookie, /HttpOnly/);
  assert.match(receipt.setCookie, /SameSite=Lax/);
  const token = auth.cookieValue(request(receipt.setCookie), auth.SESSION_COOKIE)!;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(auth.sessionUser(request(receipt.setCookie)), 'fredou');
  assert.equal(db.prepare('SELECT user_id FROM sessions WHERE token_hash=?').get(token), undefined);
  assert.equal(db.prepare('SELECT user_id FROM sessions WHERE token_hash=?').get(auth.hashToken(token))?.user_id, 'fredou');
  const stored = db.prepare('SELECT response FROM auth_receipts ORDER BY rowid DESC LIMIT 1').get()?.response;
  assert.equal(String(stored).includes(token), false, 'replay cookie must be encrypted at rest');
});

test('same login intent replays the same cookie without creating a second session', () => {
  const key = randomUUID();
  const first = login('iris', key);
  const beforeCount = db.prepare('SELECT COUNT(*) AS n FROM sessions').get()?.n;
  const repeated = login('iris', key);
  assert.deepEqual(repeated, first);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()?.n, beforeCount);
  assert.equal(auth.sessionUser(request(repeated.setCookie)), 'iris');
});

test('an idempotency key cannot be reused for another account or action', () => {
  const key = randomUUID();
  const receipt = login('fredou', key);
  assert.throws(() => login('iris', key), hasCode('IDEMPOTENCY_CONFLICT'));
  assert.throws(() => auth.performAuthAction(request(receipt.setCookie), { type: 'logout' }, key), hasCode('IDEMPOTENCY_CONFLICT'));
  assert.equal(auth.sessionUser(request(receipt.setCookie)), 'fredou');
});

test('logout revokes the session and retries work after the cookie has disappeared', () => {
  const loggedIn = login();
  const key = randomUUID();
  const first = auth.performAuthAction(request(loggedIn.setCookie), { type: 'logout' }, key);
  assert.equal(auth.sessionUser(request(loggedIn.setCookie)), null);
  assert.match(first.setCookie, /Max-Age=0/);
  const replay = auth.performAuthAction(request(), { type: 'logout' }, key);
  assert.deepEqual(replay, first);
  assert.throws(() => auth.performAuthAction(request(), { type: 'logout' }, randomUUID()), hasCode('AUTH_REQUIRED'));
});

test('a stale login replay cannot expose a private state after logout', () => {
  const key = randomUUID();
  const loggedIn = login('noam', key);
  auth.performAuthAction(request(loggedIn.setCookie), { type: 'logout' }, randomUUID());
  assert.equal(auth.sessionUser(request(loggedIn.setCookie)), null);
  assert.throws(() => login('noam', key), hasCode('CONFLICT'));
});

test('session rotation revokes the previous cookie and expired sessions do not authenticate', () => {
  const initial = login();
  const response = new Response();
  auth.attachSession(response, 'iris', request(initial.setCookie));
  const rotated = response.headers.get('set-cookie')!;
  assert.equal(auth.sessionUser(request(initial.setCookie)), null);
  assert.equal(auth.sessionUser(request(rotated)), 'iris');
  const token = auth.cookieValue(request(rotated), auth.SESSION_COOKIE)!;
  db.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=?').run('2000-01-01T00:00:00.000Z', auth.hashToken(token));
  assert.equal(auth.sessionUser(request(rotated)), null);
});

test('demo login and replay are disabled when local development is disabled', () => {
  const key = randomUUID();
  login('fredou', key);
  process.env.LOCAL_DEV_MODE = 'false';
  try {
    assert.throws(() => login('fredou'), hasCode('FORBIDDEN'));
    assert.throws(() => login('fredou', key), hasCode('FORBIDDEN'));
  } finally { process.env.LOCAL_DEV_MODE = 'true'; }
});

test('Discord account identities cannot be selected through the demo login', () => {
  const id = database.createUser({ username: 'OAuth fixture', discordId: '1234567890', mode: 'discord', role: 'player' });
  assert.throws(() => login(id), hasCode('NOT_FOUND'));
});

test('OAuth nonce validation rejects Unicode, missing values and mismatched bytes', () => {
  const valid = 'a'.repeat(64);
  assert.equal(auth.validOAuthState(valid, valid), true);
  for (const stored of [null, '', 'é'.repeat(64), 'z'.repeat(64), 'b'.repeat(64), '%'.repeat(64)]) {
    assert.equal(auth.validOAuthState(valid, stored), false);
  }
  assert.equal(auth.validOAuthState(null, valid), false);
});

test('OAuth never pretends to connect without server credentials', async () => {
  assert.equal(auth.discordConfigured(), false);
  assert.throws(() => auth.beginDiscordLogin(), hasCode('OAUTH_UNAVAILABLE'));
  await assert.rejects(auth.finishDiscordLogin(new Request('http://localhost:3000/api/auth/discord/callback')), hasCode('OAUTH_UNAVAILABLE'));
});

test('OAuth nonce is hashed, expires and is consumed once even on user cancellation', async () => {
  process.env.DISCORD_CLIENT_ID = '123456';
  process.env.DISCORD_CLIENT_SECRET = 'test-fixture-not-a-real-secret';
  try {
    const start = auth.beginDiscordLogin();
    const target = new URL(start.headers.get('location')!);
    assert.equal(target.origin, 'https://discord.com');
    assert.equal(target.searchParams.get('scope'), 'identify');
    assert.equal(target.searchParams.has('client_secret'), false);
    const state = target.searchParams.get('state')!;
    assert.equal(db.prepare('SELECT state_hash FROM oauth_states WHERE state_hash=?').get(state), undefined);
    assert.ok(db.prepare('SELECT state_hash FROM oauth_states WHERE state_hash=?').get(auth.hashToken(state)));
    const callback = new Request(`http://localhost:3000/api/auth/discord/callback?state=${state}&error=access_denied`, { headers: { cookie: start.headers.get('set-cookie')!.split(';')[0] } });
    await assert.rejects(auth.finishDiscordLogin(callback), hasCode('VALIDATION_ERROR'));
    await assert.rejects(auth.finishDiscordLogin(callback), hasCode('FORBIDDEN'));
    const expiredStart = auth.beginDiscordLogin();
    const expiredState = new URL(expiredStart.headers.get('location')!).searchParams.get('state')!;
    db.prepare('UPDATE oauth_states SET expires_at=? WHERE state_hash=?').run('2000-01-01T00:00:00.000Z', auth.hashToken(expiredState));
    const expiredRequest = new Request(`http://localhost:3000/api/auth/discord/callback?state=${expiredState}&code=unused`, { headers: { cookie: expiredStart.headers.get('set-cookie')!.split(';')[0] } });
    await assert.rejects(auth.finishDiscordLogin(expiredRequest), hasCode('FORBIDDEN'));
  } finally {
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_CLIENT_SECRET;
  }
});

test('account deletion revokes sessions and preserves an atomic replay receipt', async () => {
  const { executeAction } = await import('../src/server/engine');
  const userId = database.createUser({ username: 'Delete fixture', mode: 'development' });
  const session = login(userId);
  const key = randomUUID();
  assert.throws(() => executeAction(userId, { type: 'account-delete', confirmation: 'wrong name' }, randomUUID()), hasCode('VALIDATION_ERROR'));
  assert.equal(auth.sessionUser(request(session.setCookie)), userId);
  const action = { type: 'account-delete' as const, confirmation: 'Delete fixture' };
  const result = executeAction(userId, action, key);
  assert.equal(db.prepare('SELECT id FROM users WHERE id=?').get(userId), undefined);
  assert.equal(auth.sessionUser(request(session.setCookie)), null);
  const replay = auth.authReplay(action, key);
  assert.ok(replay);
  assert.deepEqual(replay.result, result);
  assert.throws(() => auth.authReplay({ type: 'account-delete', confirmation: 'different' }, key), hasCode('IDEMPOTENCY_CONFLICT'));
});
