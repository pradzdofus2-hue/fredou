import { beginPgDiscordLogin } from '@/server/postgres-discord';
import { beginDiscordLogin } from '@/server/auth';
import { errorResponse, rateLimit } from '@/server/http';
export const runtime='nodejs';
export async function GET() {
  try { rateLimit('oauth-start',20); return process.env.PG_AUTH_ENABLED === 'true' ? await beginPgDiscordLogin() : beginDiscordLogin(); }
  catch(error) { return errorResponse(error); }
}
