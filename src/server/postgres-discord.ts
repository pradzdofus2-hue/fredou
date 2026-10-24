import { randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { appOrigin, HttpError } from './http';
import { cookieValue, hashToken, SESSION_COOKIE } from './auth';
import { pgTransaction } from './postgres';
import { findOrCreateDiscordPlayer, createPgSession } from './postgres-auth';

const STATE_COOKIE = 'fredou_oauth_state';
const SESSION_AGE = 7 * 86400;
function cookie(name: string, value: string, age: number): string {
  const secure = appOrigin().startsWith('https:') ? '; Secure' : '';
  return name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + age + secure;
}
function settings() {
  const clientId=process.env.DISCORD_CLIENT_ID, secret=process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !secret) throw new HttpError('OAUTH_UNAVAILABLE','Discord indisponible.',503);
  return {clientId, secret, redirectUri:process.env.DISCORD_REDIRECT_URI || appOrigin()+'/api/auth/discord/callback'};
}
export async function beginPgDiscordLogin(): Promise<Response> {
  const cfg=settings();
  const state=randomBytes(32).toString('hex');
  await pgTransaction(async client => {
    await client.query('DELETE FROM oauth_states WHERE expires_at <= $1',[new Date().toISOString()]);
    await client.query('INSERT INTO oauth_states(state_hash,expires_at) VALUES($1,$2)',
      [hashToken(state),new Date(Date.now()+600000).toISOString()]);
  });
  const url=new URL('https://discord.com/oauth2/authorize');
  url.search=new URLSearchParams({client_id:cfg.clientId,redirect_uri:cfg.redirectUri,response_type:'code',scope:'identify',state}).toString();
  const response=new Response(null,{status:302,headers:{Location:url.toString(),'Cache-Control':'no-store'}});
  response.headers.append('Set-Cookie',cookie(STATE_COOKIE,state,600));
  return response;
}
export async function finishPgDiscordLogin(request: Request): Promise<Response> {
  const cfg=settings();
  const url=new URL(request.url), state=url.searchParams.get('state');
  const stored=cookieValue(request,STATE_COOKIE), code=url.searchParams.get('code');
  const valid=!!state && !!stored && /^[a-f0-9]{64}$/.test(state) && /^[a-f0-9]{64}$/.test(stored) &&
    timingSafeEqual(Buffer.from(state),Buffer.from(stored));
  if (!valid) throw new HttpError('FORBIDDEN','Session OAuth invalide ou expirée.',403);
  if (url.searchParams.has('iss') && url.searchParams.get('iss')!=='https://discord.com')
    throw new HttpError('FORBIDDEN','Fournisseur OAuth incorrect.',403);
  const consumed=await pgTransaction(async client=>{
    const result=await client.query('DELETE FROM oauth_states WHERE state_hash=$1 AND expires_at>$2 RETURNING state_hash',
      [hashToken(state!),new Date().toISOString()]);
    return result.rowCount === 1;
  });
  if (!consumed) throw new HttpError('FORBIDDEN','Session OAuth déjà consommée.',403);
  if (!code || code.length>2048) throw new HttpError('VALIDATION_ERROR','Code Discord absent.',400);
  const tokenRes=await fetch('https://discord.com/api/oauth2/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.secret,grant_type:'authorization_code',code,redirect_uri:cfg.redirectUri}),
    signal:AbortSignal.timeout(10000)
  });
  if (!tokenRes.ok) throw new HttpError('FORBIDDEN','Discord a refusé la connexion.',403);
  const token=z.object({access_token:z.string().min(1)}).parse(await tokenRes.json());
  const profileRes=await fetch('https://discord.com/api/v10/users/@me',{
    headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(10000)
  });
  if (!profileRes.ok) throw new HttpError('FORBIDDEN','Profil Discord indisponible.',403);
  const profile=z.object({id:z.string().regex(/^\d{1,30}$/),username:z.string().min(1),global_name:z.string().nullable().optional(),avatar:z.string().nullable()}).parse(await profileRes.json());
  const user=await findOrCreateDiscordPlayer({
    discordId:profile.id,username:(profile.global_name||profile.username).slice(0,40),
    avatar:profile.avatar ? 'https://cdn.discordapp.com/avatars/'+profile.id+'/'+profile.avatar+'.png' : null
  });
  const session=await createPgSession(user.id);
  const response=new Response(null,{status:302,headers:{Location:appOrigin()+'/', 'Cache-Control':'no-store'}});
  response.headers.append('Set-Cookie',cookie(SESSION_COOKIE,session,SESSION_AGE));
  response.headers.append('Set-Cookie',cookie(STATE_COOKIE,'',0));
  return response;
}
