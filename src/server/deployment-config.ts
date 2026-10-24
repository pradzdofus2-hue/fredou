/** Pure production preflight; never return raw secrets or database credentials. */
export function validateDeploymentConfig(env:NodeJS.ProcessEnv):string[]{
 const errors:string[]=[];
 const required=['APP_URL','DATABASE_URL','DISCORD_CLIENT_ID','DISCORD_CLIENT_SECRET'] as const;
 const missing=required.filter(name=>!env[name]?.trim());
 if(missing.length)errors.push('Variables absentes : '+missing.join(', '));
 const flags=['PG_AUTH_ENABLED','PG_STATE_ENABLED','PG_GAME_ACTIONS_ENABLED'] as const;
 const disabled=flags.filter(name=>env[name]!=='true');
 if(disabled.length)errors.push('Modes PostgreSQL non activés : '+disabled.join(', '));
 let origin:URL|undefined;
 try{
  origin=new URL(env.APP_URL||'');
  if(origin.protocol!=='https:'||!origin.hostname||origin.username||origin.password||
     origin.search||origin.hash||origin.pathname!=='/'||
     ['localhost','127.0.0.1','::1','[::1]'].includes(origin.hostname.toLowerCase()))origin=undefined;
 }catch{origin=undefined;}
 if(!origin)errors.push('APP_URL doit être une origine HTTPS publique (sans chemin, identifiants ou paramètres).');
 if(env.LOCAL_DEV_MODE==='true')errors.push('LOCAL_DEV_MODE doit être désactivé en production.');
 if(env.DISCORD_REDIRECT_URI){
  if(!origin||env.DISCORD_REDIRECT_URI!==new URL('/api/auth/discord/callback',origin).toString())
   errors.push('DISCORD_REDIRECT_URI ne correspond pas à APP_URL + /api/auth/discord/callback.');
 }
 if(env.DATABASE_URL){
  try{
   const db=new URL(env.DATABASE_URL);
   if(!['postgres:','postgresql:'].includes(db.protocol)||!db.hostname||!db.username||!db.password)
    errors.push('DATABASE_URL doit être une URI PostgreSQL complète avec authentification.');
   if(db.hostname==='localhost'||db.hostname==='127.0.0.1'||db.hostname==='::1')
    errors.push('DATABASE_URL pointe vers une base locale inaccessible depuis Vercel.');
   if(db.password.includes('[YOUR-PASSWORD]')||db.password.toLowerCase().includes('your-password'))
    errors.push('DATABASE_URL contient un mot de passe fictif.');
  }catch{errors.push('DATABASE_URL doit être une URI PostgreSQL valide.');}
 }
 return errors;
}
