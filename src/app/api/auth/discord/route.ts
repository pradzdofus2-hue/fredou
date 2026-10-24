import { hostedDatabaseUnavailable } from '@/server/hosted-runtime';
import { json, appOrigin } from '@/server/http';
import { canonicalOauthStart } from '@/server/oauth-origin';
import { beginPgDiscordLogin } from '@/server/postgres-discord';
import { beginDiscordLogin } from '@/server/auth';
import { errorResponse, rateLimit } from '@/server/http';
export const runtime='nodejs';
export async function GET(request?:Request) {
  if(hostedDatabaseUnavailable()) return json({error:'La connexion est indisponible sur cet hébergement.'},503);
  try {
    const canonical=request ? canonicalOauthStart(request.url,appOrigin()) : null;
    if(canonical) return new Response(null,{status:302,headers:{Location:canonical,'Cache-Control':'no-store'}});
    rateLimit('oauth-start',20); return process.env.PG_AUTH_ENABLED === 'true' ? await beginPgDiscordLogin() : beginDiscordLogin(); }
  catch(error) { return errorResponse(error); }
}
