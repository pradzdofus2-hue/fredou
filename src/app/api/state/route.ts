import { hostedDatabaseUnavailable } from '@/server/hosted-runtime';
import { cookieValue, SESSION_COOKIE } from '@/server/auth';
import { getPgSessionUser } from '@/server/postgres-auth';
import { pgState } from '@/server/postgres-state';
import { sessionUser } from '@/server/auth';
import { getState } from '@/server/engine';
import { errorResponse, json } from '@/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (hostedDatabaseUnavailable()) return json({error:'Le jeu PostgreSQL n’est pas prêt sur cet hébergement.'},503);
  if (process.env.PG_AUTH_ENABLED === 'true') {
    if (process.env.PG_STATE_ENABLED !== 'true')
      return json({error:'État PostgreSQL non activé.'},503);
    try {
      const userId = await getPgSessionUser(cookieValue(request, SESSION_COOKIE));
      return json(await pgState(userId));
    } catch (error) { return errorResponse(error); }
  }
  try { return json(getState(sessionUser(request))); }
  catch (error) { return errorResponse(error); }
}
