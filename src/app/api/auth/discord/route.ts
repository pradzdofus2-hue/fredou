import { beginDiscordLogin } from '@/server/auth';
import { errorResponse, rateLimit } from '@/server/http';
export const runtime='nodejs';
export async function GET() {
  try { rateLimit('oauth-start',20); return beginDiscordLogin(); }
  catch(error) { return errorResponse(error); }
}
