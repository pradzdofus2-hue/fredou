import { createHash, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { z } from 'zod';
import { getDb, createUser } from './database';
import { appOrigin, HttpError, isLocalDevelopment } from './http';
import type { Action, ActionResult } from '../lib/contracts';

export const SESSION_COOKIE = 'fredou_session';
const STATE_COOKIE = 'fredou_oauth_state';
const SESSION_AGE = 7 * 24 * 60 * 60;
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export function cookieValue(request: Request, name: string): string | null {
  const entry = request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(name.length+1)); } catch { return null; }
}
function cookie(name: string, value: string, age: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${appOrigin().startsWith('https:')?'; Secure':''}`;
}
export function sessionUser(request: Request): string | null {
  const token = cookieValue(request,SESSION_COOKIE);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = getDb().prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?').get(hashToken(token),new Date().toISOString()) as {user_id:string}|undefined;
  return row?.user_id ?? null;
}
export function attachSession(response: Response, userId: string, request?: Request): void {
  const db=getDb();
  if (request) {
    const oldToken=cookieValue(request,SESSION_COOKIE);
    if (oldToken) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(oldToken));
  }
  const token=randomBytes(32).toString('hex');
  const now=new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(hashToken(token),userId,new Date(Date.now()+SESSION_AGE*1000).toISOString());
  response.headers.append('Set-Cookie',cookie(SESSION_COOKIE,token,SESSION_AGE));
}
export function clearSession(response: Response, request: Request): void {
  const token=cookieValue(request,SESSION_COOKIE);
  if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  response.headers.append('Set-Cookie',cookie(SESSION_COOKIE,'',0));
}
export function developmentLogin(userId: string): void {
  if (!isLocalDevelopment()) throw new HttpError('FORBIDDEN','Le mode développement local est désactivé.',403);
  const user=getDb().prepare('SELECT mode FROM users WHERE id = ?').get(userId) as {mode:string}|undefined;
  if (!user || user.mode!=='development') throw new HttpError('NOT_FOUND','Ce compte fictif n’existe pas.',404);
}
export function discordConfigured(): boolean { return !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET); }
function oauthSettings() {
  if (!discordConfigured()) throw new HttpError('OAUTH_UNAVAILABLE','Discord n’est pas configuré. Utilisez les comptes locaux de démonstration.',503);
  return {
    clientId: process.env.DISCORD_CLIENT_ID!, clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    redirectUri: process.env.DISCORD_REDIRECT_URI || `${appOrigin()}/api/auth/discord/callback`
  };
}
export function beginDiscordLogin(): Response {
  const settings=oauthSettings();
  const state=randomBytes(32).toString('hex');
  const db=getDb();
  db.prepare('DELETE FROM oauth_states WHERE expires_at <= ?').run(new Date().toISOString());
  db.prepare('INSERT INTO oauth_states (state_hash, expires_at) VALUES (?,?)').run(hashToken(state),new Date(Date.now()+600_000).toISOString());
  const url=new URL('https://discord.com/oauth2/authorize');
  url.search=new URLSearchParams({client_id:settings.clientId,redirect_uri:settings.redirectUri,response_type:'code',scope:'identify',state}).toString();
  const response=new Response(null,{status:302,headers:{Location:url.href,'Cache-Control':'no-store'}});
  response.headers.append('Set-Cookie',cookie(STATE_COOKIE,state,600));
  return response;
}
export async function finishDiscordLogin(request: Request): Promise<Response> {
  const settings=oauthSettings();
  const url=new URL(request.url);
  const state=url.searchParams.get('state');
  const stored=cookieValue(request,STATE_COOKIE);
  const code=url.searchParams.get('code');
  if (!validOAuthState(state,stored)) {
    throw new HttpError('FORBIDDEN','La demande Discord est invalide ou expirée. Recommencez la connexion.',403);
  }
  if (url.searchParams.has('iss') && url.searchParams.get('iss')!=='https://discord.com') throw new HttpError('FORBIDDEN','Fournisseur OAuth incorrect.',403);
  const consumed=getDb().prepare('DELETE FROM oauth_states WHERE state_hash = ? AND expires_at > ? RETURNING state_hash').get(hashToken(state!),new Date().toISOString());
  if (!consumed) throw new HttpError('FORBIDDEN','Cette demande Discord a expiré ou a déjà été utilisée.',403);
  if (!code || code.length>2048) throw new HttpError('VALIDATION_ERROR','Connexion Discord annulée ou code manquant.',400);
  const tokenResponse=await fetch('https://discord.com/api/oauth2/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:settings.clientId,client_secret:settings.clientSecret,grant_type:'authorization_code',code,redirect_uri:settings.redirectUri}),
    signal:AbortSignal.timeout(10_000)
  });
  if (!tokenResponse.ok) throw new HttpError('FORBIDDEN','Discord a refusé cette connexion. Recommencez.',403);
  const token=z.object({access_token:z.string().min(1),token_type:z.string()}).parse(await tokenResponse.json());
  const profileResponse=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(10_000)});
  if (!profileResponse.ok) throw new HttpError('FORBIDDEN','Impossible de lire votre profil Discord.',403);
  const profile=z.object({id:z.string().regex(/^\d{1,30}$/),username:z.string().min(1).max(100),global_name:z.string().nullable().optional(),avatar:z.string().regex(/^[a-zA-Z0-9_]+$/).nullable()}).parse(await profileResponse.json());
  const avatar=profile.avatar?`https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`:null;
  const username=(profile.global_name||profile.username).slice(0,40);
  const db=getDb();
  const existing=db.prepare('SELECT id FROM users WHERE discord_id = ?').get(profile.id) as {id:string}|undefined;
  const userId=existing?.id || createUser({username,avatar,discordId:profile.id,mode:'discord',role:'player'});
  if (existing) db.prepare('UPDATE users SET username = ?, avatar = ? WHERE id = ?').run(username,avatar,userId);
  const response=new Response(null,{status:302,headers:{Location:appOrigin()+'/','Cache-Control':'no-store'}});
  attachSession(response,userId,request);
  response.headers.append('Set-Cookie',cookie(STATE_COOKIE,'',0));
  return response;
}

export function validOAuthState(state: string | null, stored: string | null): boolean {
  return !!state && !!stored && /^[a-f0-9]{64}$/.test(state) && /^[a-f0-9]{64}$/.test(stored) && timingSafeEqual(Buffer.from(state),Buffer.from(stored));
}

interface AuthReceipt { result: ActionResult; sealedCookie?: string; }
function receiptSecret(): Buffer {
  const path=resolve('data/session.key');
  mkdirSync(dirname(path),{recursive:true});
  try { writeFileSync(path,randomBytes(32),{flag:'wx',mode:0o600}); }
  catch(error) { if (!(error instanceof Error && 'code' in error && error.code==='EEXIST')) throw error; }
  const secret=readFileSync(path);
  if(secret.length!==32) throw new Error('InvalidSessionKey');
  return secret;
}
function sealCookie(value: string): string {
  const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',receiptSecret(),iv);
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
}
function unsealCookie(value: string): string {
  const bytes=Buffer.from(value,'base64');const decipher=createDecipheriv('aes-256-gcm',receiptSecret(),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
}
export function authReplay(action: Action, key: string): {result: ActionResult; setCookie?:string} | null {
  const row=getDb().prepare('SELECT action_hash,response FROM auth_receipts WHERE id=? AND expires_at>?').get(hashToken(key),new Date().toISOString()) as {action_hash:string;response:string}|undefined;
  if(!row) return null;
  if(row.action_hash!==hashToken(JSON.stringify(action))) throw new HttpError('IDEMPOTENCY_CONFLICT','Cette clé correspond à une autre requête.',409);
  const receipt=JSON.parse(row.response) as AuthReceipt;
  const setCookie=receipt.sealedCookie?unsealCookie(receipt.sealedCookie):undefined;
  if(action.type==='login-dev') {
    const token=setCookie?.split(';')[0].slice(SESSION_COOKIE.length+1);
    const active=token && getDb().prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(hashToken(token),new Date().toISOString()) as {user_id:string}|undefined;
    if(!active || active.user_id!==action.userId) throw new HttpError('CONFLICT','Cette connexion a été révoquée. Recommencez avec une nouvelle demande.',409);
  }
  return {result:receipt.result,setCookie};
}
export function performAuthAction(request: Request, action: Extract<Action,{type:'login-dev'|'logout'}>, key: string): {result:ActionResult;setCookie:string} {
  const db=getDb();
  if(action.type==='login-dev') developmentLogin(action.userId);
  db.exec('BEGIN IMMEDIATE');
  try {
    const replay=authReplay(action,key);
    if(replay) { db.exec('COMMIT');return {result:replay.result,setCookie:replay.setCookie||cookie(SESSION_COOKIE,'',0)}; }
    const response=new Response();
    if(action.type==='login-dev') { developmentLogin(action.userId);attachSession(response,action.userId,request); }
    else { if(!sessionUser(request)) throw new HttpError('AUTH_REQUIRED','Connectez-vous pour effectuer cette action.',401);clearSession(response,request); }
    const result:ActionResult={type:action.type,message:action.type==='login-dev'?'Compte de démonstration connecté.':'Vous êtes déconnecté.'};
    const setCookie=response.headers.get('set-cookie')!;
    const receipt:AuthReceipt={result,sealedCookie:sealCookie(setCookie)};
    db.prepare('DELETE FROM auth_receipts WHERE expires_at <= ?').run(new Date().toISOString());
    db.prepare('INSERT INTO auth_receipts(id,action_hash,response,expires_at) VALUES(?,?,?,?)').run(hashToken(key),hashToken(JSON.stringify(action)),JSON.stringify(receipt),new Date(Date.now()+86_400_000).toISOString());
    db.exec('COMMIT');return {result,setCookie};
  } catch(error) { db.exec('ROLLBACK');throw error; }
}
