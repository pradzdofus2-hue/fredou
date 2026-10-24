import { hostedDatabaseUnavailable } from '@/server/hosted-runtime';
import { json } from '@/server/http';
import { finishPgDiscordLogin } from '@/server/postgres-discord';
import { finishDiscordLogin } from '@/server/auth';
import { errorResponse, rateLimit } from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request) {
  if(hostedDatabaseUnavailable()) return json({error:'La connexion est indisponible sur cet hébergement.'},503);
  try { rateLimit('oauth-callback',20); return process.env.PG_AUTH_ENABLED === 'true' ? await finishPgDiscordLogin(request) : await finishDiscordLogin(request); }
  catch(error) { return errorResponse(error); }
}
