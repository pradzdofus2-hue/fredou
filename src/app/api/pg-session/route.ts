import { pgSessionProfile } from '@/server/postgres-session';
import { json } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Isolated PostgreSQL session probe. It is intentionally not the game state
 * endpoint until all game actions and DTOs use the same persistent database.
 */
export async function GET(request: Request): Promise<Response> {
  if (process.env.PG_AUTH_ENABLED !== 'true') {
    return json({error: 'Authentification PostgreSQL non activée.'}, 503);
  }
  try {
    const user = await pgSessionProfile(request);
    return json({authenticated: !!user, user});
  } catch {
    return json({error: 'Session temporairement indisponible.'}, 503);
  }
}
