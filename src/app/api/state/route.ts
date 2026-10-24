import { sessionUser } from '@/server/auth';
import { getState } from '@/server/engine';
import { errorResponse, json } from '@/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  // Do not mix Supabase sessions with the SQLite game engine during migration.
  if (process.env.PG_AUTH_ENABLED === 'true') {
    return json({error: 'Le moteur PostgreSQL du jeu n\u2019est pas encore activé.'}, 503);
  }
  try { return json(getState(sessionUser(request))); }
  catch (error) { return errorResponse(error); }
}
