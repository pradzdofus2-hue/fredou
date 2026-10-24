import { cookieValue, SESSION_COOKIE } from '@/server/auth';
import { getPgSessionUser } from '@/server/postgres-auth';
import { openPgBooster } from '@/server/postgres-boosters';
import { buyPgBooster } from '@/server/postgres-booster-purchases';
import { parseAction } from '@/server/validation';
import { errorResponse, HttpError, json, rateLimit, readJsonBody, validateIdempotencyKey, validateOrigin } from '@/server/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/** Separate pilot endpoint: game state still uses legacy SQLite until cutover. */
export async function POST(request:Request):Promise<Response>{
  if(process.env.PG_BOOSTERS_ENABLED!=='true')
    return json({error:'Boosters PostgreSQL non activés.'},503);
  try{
    validateOrigin(request);
    const key=validateIdempotencyKey(request.headers.get('Idempotency-Key'));
    const userId=await getPgSessionUser(cookieValue(request,SESSION_COOKIE));
    if(!userId)throw new HttpError('AUTH_REQUIRED','Connectez-vous avec Discord.',401);
    rateLimit(userId);
    const action=parseAction(await readJsonBody(request));
    if(action.type==='open') return json({result:await openPgBooster(userId,action.boosterId,key)});
    if(action.type==='buy-booster') return json({result:await buyPgBooster(userId,action.boosterId,action.quantity,key)});
    throw new HttpError('VALIDATION_ERROR','Action booster non prise en charge.',422);
  }catch(error){return errorResponse(error);}
}
