/** Production deployment preflight. Only prints variable names, never secret values. */
const required = ['APP_URL','DATABASE_URL','DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET'];
const missing = required.filter(name => !process.env[name]?.trim());
const flags = ['PG_AUTH_ENABLED','PG_STATE_ENABLED','PG_GAME_ACTIONS_ENABLED'] as const;
const wrongFlags = flags.filter(name=>process.env[name]!=='true');
const appUrl = process.env.APP_URL || '';
let secureOrigin=false;
try {
  const parsed = new URL(appUrl);
  secureOrigin=parsed.protocol==='https:' && Boolean(parsed.hostname) && !['localhost','127.0.0.1'].includes(parsed.hostname);
} catch { /* no valid public origin */ }

const errors:string[]=[];
if(missing.length) errors.push('Variables absentes : '+missing.join(', '));
if(wrongFlags.length) errors.push('Modes PostgreSQL non activés : '+wrongFlags.join(', '));
if(!secureOrigin) errors.push('APP_URL doit être une URL publique HTTPS.');
if(process.env.LOCAL_DEV_MODE==='true') errors.push('LOCAL_DEV_MODE doit être désactivé en production.');
if(process.env.DISCORD_REDIRECT_URI) {
  if(!secureOrigin || process.env.DISCORD_REDIRECT_URI!==new URL('/api/auth/discord/callback',appUrl).toString()) {
    errors.push('DISCORD_REDIRECT_URI ne correspond pas à APP_URL + /api/auth/discord/callback.');
  }
}
if(process.env.DATABASE_URL?.includes('[YOUR-PASSWORD]')) errors.push('DATABASE_URL contient le mot de passe fictif du modèle.');
if(errors.length) {
  console.error('Déploiement bloqué :\n- '+errors.join('\n- '));
  process.exitCode=1;
} else {
  console.log('Précontrôle configuration OK : PostgreSQL, Discord, HTTPS et modes de jeu.');
  console.log('Ce contrôle ne vérifie ni les connexions réelles, ni les images publiées, ni les transactions.');
}
