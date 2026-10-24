import { cookieValue, SESSION_COOKIE } from './auth';
import { getPgSessionUser } from './postgres-auth';
import { pgRead } from './postgres';

export interface PgSessionProfile {
  id: string;
  username: string;
  avatar: string | null;
  balance: number;
  role: 'player' | 'admin';
  reducedMotion: boolean;
}

/**
 * Reads a server-side, hashed session and the corresponding profile.
 * Never accepts a user ID from the browser as proof of identity.
 */
export async function pgSessionProfile(request: Request): Promise<PgSessionProfile | null> {
  const id = await getPgSessionUser(cookieValue(request, SESSION_COOKIE));
  if (!id) return null;
  const rows = await pgRead<{
    id: string;
    username: string;
    avatar: string | null;
    balance: number;
    role: 'player' | 'admin';
    reduced_motion: number;
  }>(
    'SELECT id, username, avatar, balance, role, reduced_motion FROM users WHERE id=$1',
    [id]
  );
  const user = rows[0];
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    balance: user.balance,
    role: user.role,
    reducedMotion: !!user.reduced_motion
  };
}
