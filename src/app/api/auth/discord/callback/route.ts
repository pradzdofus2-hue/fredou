import { finishPgDiscordLogin } from '@/server/postgres-discord';
import { finishDiscordLogin } from '@/server/auth';
import { errorResponse, rateLimit } from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request) {
  try { rateLimit('oauth-callback',20); return process.env.PG_AUTH_ENABLED === 'true' ? await finishPgDiscordLogin(request) : await finishDiscordLogin(request); }
  catch(error) { return errorResponse(error); }
}
