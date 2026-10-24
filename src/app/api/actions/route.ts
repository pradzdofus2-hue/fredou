import { authReplay, clearSession, performAuthAction, sessionUser } from '@/server/auth';
import { executeAction, getState, parseAction } from '@/server/engine';
import { errorResponse, HttpError, json, rateLimit, readJsonBody, validateIdempotencyKey, validateOrigin } from '@/server/http';
import type { ActionResponse } from '@/lib/contracts';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    validateOrigin(request);
    const key=validateIdempotencyKey(request.headers.get('Idempotency-Key'));
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
