import { hostedDatabaseUnavailable } from '@/server/hosted-runtime';
import { json } from '@/server/http';
import { beginPgDiscordLogin } from '@/server/postgres-discord';
import { beginDiscordLogin } from '@/server/auth';
import { errorResponse, rateLimit } from '@/server/http';
export const runtime='nodejs';
export async function GET() {
  if(hostedDatabaseUnavailable()) return json({error:'La connexion est indisponible sur cet hébergement.'},503);
  try { rateLimit('oauth-start',20); return process.env.PG_AUTH_ENABLED === 'true' ? await beginPgDiscordLogin() : beginDiscordLogin(); }
  catch(error) { return errorResponse(error); }
}
