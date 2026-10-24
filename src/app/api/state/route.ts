import { sessionUser } from '@/server/auth';
import { getState } from '@/server/engine';
import { errorResponse, json } from '@/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return json(getState(sessionUser(request))); }
  catch (error) { return errorResponse(error); }
}
