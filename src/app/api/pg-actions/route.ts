import { hostedDatabaseUnavailable } from '@/server/hosted-runtime';
import { cookieValue, SESSION_COOKIE } from '@/server/auth';
import { getPgSessionUser } from '@/server/postgres-auth';
import { executePgSimpleAction } from '@/server/postgres-simple-actions';
import { parseAction } from '@/server/validation';
import { errorResponse, HttpError, json, readJsonBody, validateIdempotencyKey, validateOrigin, rateLimit } from '@/server/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/** Pilot endpoint, not the main game action endpoint yet. */
export async function POST(request:Request):Promise<Response> {
  if (hostedDatabaseUnavailable()) return json({error:'Le jeu PostgreSQL n’est pas prêt sur cet hébergement.'},503);
  if (process.env.PG_SIMPLE_ACTIONS_ENABLED !== 'true') {
    return json({error:'Actions PostgreSQL non activées.'},503);
  }
  try {
    validateOrigin(request);
    const key=validateIdempotencyKey(request.headers.get('Idempotency-Key'));
    const userId=await getPgSessionUser(cookieValue(request,SESSION_COOKIE));
    if (!userId) throw new HttpError('AUTH_REQUIRED','Connectez-vous avec Discord.',401);
    rateLimit(userId);
    const action=parseAction(await readJsonBody(request));
    if (action.type !== 'favorite' && action.type !== 'preferences')
      throw new HttpError('VALIDATION_ERROR','Action non disponible sur cet endpoint.',422);
    return json({result:await executePgSimpleAction(userId,action,key)});
  } catch(error) { return errorResponse(error); }
}
