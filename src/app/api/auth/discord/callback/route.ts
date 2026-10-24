import { finishDiscordLogin } from '@/server/auth';
import { errorResponse, rateLimit } from '@/server/http';
export const runtime='nodejs';
export async function GET(request:Request) {
  try { rateLimit('oauth-callback',20); return await finishDiscordLogin(request); }
  catch(error) { return errorResponse(error); }
}
