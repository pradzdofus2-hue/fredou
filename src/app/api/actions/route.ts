import { deletePgAccount } from '@/server/postgres-account-delete';
import { pgSaveEvent } from '@/server/postgres-events';
import { pgRecycle } from '@/server/postgres-recycle';
import { pgReferral } from '@/server/postgres-referral';
import { pgTradeAction } from '@/server/postgres-trades';
import { pgBuyListing } from '@/server/postgres-market-buy';
import { pgListingAction } from '@/server/postgres-listings';
import { cookieValue, SESSION_COOKIE } from '@/server/auth';
import { getPgSessionUser, revokePgSession } from '@/server/postgres-auth';
import { pgState } from '@/server/postgres-state';
import { openPgBooster } from '@/server/postgres-boosters';
import { buyPgBooster } from '@/server/postgres-booster-purchases';
import { executePgSimpleAction } from '@/server/postgres-simple-actions';
import { authReplay, clearSession, performAuthAction, sessionUser } from '@/server/auth';
import { executeAction, getState, parseAction } from '@/server/engine';
import { errorResponse, HttpError, json, rateLimit, readJsonBody, validateIdempotencyKey, validateOrigin } from '@/server/http';
import type { ActionResponse } from '@/lib/contracts';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const key=validateIdempotencyKey(request.headers.get('Idempotency-Key'));
    if (process.env.PG_AUTH_ENABLED === 'true') {
      if (process.env.PG_STATE_ENABLED !== 'true') return json({error:'Moteur PostgreSQL inactif.'},503);
      const token=cookieValue(request,SESSION_COOKIE);
      const pgUser=await getPgSessionUser(token);
      rateLimit(pgUser || 'anonymous-pg');
      const pgAction=parseAction(await readJsonBody(request));
      if (!pgUser) throw new HttpError('AUTH_REQUIRED','Connectez-vous avec Discord.',401);
      if (pgAction.type === 'logout') {
        await revokePgSession(token);
        const response=json({state:await pgState(null),result:{type:'logout',message:'Vous êtes déconnecté.'}} satisfies ActionResponse);
        response.headers.append('Set-Cookie','fredou_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+(process.env.APP_URL?.startsWith('https:')?'; Secure':''));
        return response;
      }
      if (process.env.PG_GAME_ACTIONS_ENABLED !== 'true') return json({error:'Actions PostgreSQL non activées.'},503);
      if (pgAction.type === 'account-delete') {
        const result=await deletePgAccount(pgUser,pgAction.confirmation);
        const response=json({state:await pgState(null),result} satisfies ActionResponse);
        response.headers.append('Set-Cookie','fredou_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+(process.env.APP_URL?.startsWith('https:')?'; Secure':''));
        return response;
      }
      const supported=pgAction.type==='open'||pgAction.type==='buy-booster'||pgAction.type==='favorite'||pgAction.type==='preferences'||pgAction.type==='listing-create'||pgAction.type==='listing-cancel'||pgAction.type==='listing-buy'||pgAction.type==='trade-create'||pgAction.type==='trade-respond'||pgAction.type==='recycle'||pgAction.type==='referral'||pgAction.type==='event-save';
      if (!supported) throw new HttpError('UNAVAILABLE','Cette fonction est en cours de migration PostgreSQL.',503);
      const result=pgAction.type==='event-save' ? await pgSaveEvent(pgUser,pgAction,key)
        : pgAction.type==='recycle' ? await pgRecycle(pgUser,pgAction,key)
        : pgAction.type==='referral' ? await pgReferral(pgUser,pgAction,key)
        : pgAction.type==='open' ? await openPgBooster(pgUser,pgAction.boosterId,key)
        : pgAction.type==='buy-booster' ? await buyPgBooster(pgUser,pgAction.boosterId,pgAction.quantity,key)
        : (pgAction.type==='trade-create'||pgAction.type==='trade-respond') ? await pgTradeAction(pgUser,pgAction,key)
        : pgAction.type==='listing-buy' ? await pgBuyListing(pgUser,pgAction.listingId,key)
        : (pgAction.type==='listing-create'||pgAction.type==='listing-cancel') ? await pgListingAction(pgUser,pgAction,key)
        : await executePgSimpleAction(pgUser,pgAction,key);
      return json({state:await pgState(pgUser),result} satisfies ActionResponse);
    }
    const userId=sessionUser(request);
    rateLimit(userId || 'anonymous-local');
    const action=parseAction(await readJsonBody(request));
    if (action.type==='login-dev' || action.type==='logout') {
      const receipt=performAuthAction(request,action,key);
      const response=json({state:getState(action.type==='login-dev'?action.userId:null),result:receipt.result} satisfies ActionResponse);
      response.headers.append('Set-Cookie',receipt.setCookie);
      return response;
    }
    if(action.type==='account-delete') {
      const replay=authReplay(action,key);
      if(replay) { const response=json({state:getState(null),result:replay.result} satisfies ActionResponse);clearSession(response,request);return response; }
    }
    if (!userId) throw new HttpError('AUTH_REQUIRED','Connectez-vous pour effectuer cette action.',401);
    const result=executeAction(userId,action,key);
    const response=json({state:getState(action.type==='account-delete'?null:userId),result} satisfies ActionResponse);
    if (action.type==='account-delete') clearSession(response,request);
    return response;
  } catch(error) { return errorResponse(error); }
}
