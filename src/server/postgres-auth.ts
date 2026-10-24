import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { pgTransaction, pgRead } from './postgres';
import type { PoolClient } from 'pg';

export interface PgPlayer {
  id: string;
  username: string;
  avatar: string | null;
  discord_id: string | null;
  balance: number;
}

/**
 * Persistent Discord player creation, inside a single transaction.
 * A Discord identity is unique; racing callbacks converge on one user.
 * Existing users are never reset and receive no duplicate welcome grant.
 */
export async function findOrCreateDiscordPlayer(profile: {
  discordId: string;
  username: string;
  avatar: string | null;
}): Promise<PgPlayer> {
  return pgTransaction(async (client: PoolClient) => {
    const userId = randomUUID();
    const ref = 'FR-' + randomBytes(10).toString('hex').toUpperCase();
    const date = new Date().toISOString();
    const { rows } = await client.query<PgPlayer & {created_now:boolean}>(
      `INSERT INTO users(id,username,avatar,discord_id,mode,role,balance,referral_code,created_at)
       VALUES($1,$2,$3,$4,'discord','player',300,$5,$6)
       ON CONFLICT(discord_id) DO UPDATE SET username=EXCLUDED.username, avatar=EXCLUDED.avatar
       RETURNING id,username,avatar,discord_id,balance,(xmax = 0) AS created_now`,
      [userId, profile.username, profile.avatar, profile.discordId, ref, date]
    );
    const player = rows[0];
    if (!player) throw new Error('FREDOU_USER_CREATE_FAILED');
    // Insert initial grant only for the new row, distinguished by the generated ID.
    if (player.created_now) {
      await client.query(
        'INSERT INTO ledger(id,user_id,amount,balance_after,reason,created_at,reference_id) VALUES($1,$2,300,300,$3,$4,NULL)',
        [randomUUID(), userId, 'Bienvenue dans FREDOU COLLECTION', date]
      );
      await client.query(
        `INSERT INTO user_boosters(user_id,booster_id,available,last_refill,pity_count)
         SELECT $1,id,CASE WHEN kind='free' THEN 3 WHEN kind='daily' THEN 1 ELSE 2 END,$2,0 FROM boosters`,
        [userId, date]
      );
    }
    return {id:player.id,username:player.username,avatar:player.avatar,discord_id:player.discord_id,balance:player.balance};
  });
}

export function sessionHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createPgSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await pgTransaction(async client => {
    await client.query('DELETE FROM sessions WHERE expires_at <= $1', [new Date().toISOString()]);
    await client.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [
      sessionHash(token), userId, new Date(Date.now() + 7 * 86400000).toISOString()
    ]);
  });
  return token;
}

export async function getPgSessionUser(token: string | null): Promise<string | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await pgRead<{user_id: string}>(
    'SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>$2',
    [sessionHash(token), new Date().toISOString()]
  );
  return result[0]?.user_id ?? null;
}

export async function revokePgSession(token: string | null): Promise<void> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  await pgTransaction(async client => {
    await client.query('DELETE FROM sessions WHERE token_hash=$1', [sessionHash(token)]);
  });
}
