import { createHash } from 'node:crypto';
import { pgTransaction } from './postgres';
import { GameError } from './errors';

export type PgSimpleAction =
  | {type: 'favorite'; cardId: string}
  | {type: 'preferences'; reducedMotion: boolean};

function actionDigest(action: PgSimpleAction): string {
  return createHash('sha256').update(JSON.stringify(action)).digest('hex');
}

/** Persistent idempotency and mutations happen on the same PostgreSQL client. */
export async function executePgSimpleAction(
  userId: string, action: PgSimpleAction, key: string
): Promise<{type: PgSimpleAction['type']; message: string}> {
  return pgTransaction(async client => {
    // Serialize concurrent requests for the same user, including duplicate keys.
    const account = await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (account.rowCount !== 1) throw new GameError('AUTH_REQUIRED','Compte introuvable.',401);
    const digest = actionDigest(action);
    const previous = await client.query<{action_hash:string;response:string}>(
      'SELECT action_hash,response FROM idempotency WHERE user_id=$1 AND key=$2',
      [userId,key]
    );
    if (previous.rows[0]) {
      if (previous.rows[0].action_hash !== digest)
        throw new GameError('IDEMPOTENCY_CONFLICT','Clé déjà utilisée pour une autre action.',409);
      return JSON.parse(previous.rows[0].response) as {type: PgSimpleAction['type']; message: string};
    }
    let message: string;
    if (action.type === 'favorite') {
      const changed = await client.query(
        'UPDATE inventory SET favorite=1-favorite WHERE user_id=$1 AND card_id=$2 AND quantity>0 RETURNING favorite',
        [userId,action.cardId]
      );
      if (changed.rowCount !== 1)
        throw new GameError('NOT_FOUND','Cette carte ne figure pas dans votre collection.',404);
      message='Favori mis à jour.';
    } else {
      await client.query('UPDATE users SET reduced_motion=$1 WHERE id=$2',
        [action.reducedMotion?1:0,userId]);
      message='Préférences enregistrées.';
    }
    const response={type:action.type,message};
    await client.query(
      'INSERT INTO idempotency(user_id,key,action_hash,response,created_at) VALUES($1,$2,$3,$4,$5)',
      [userId,key,digest,JSON.stringify(response),new Date().toISOString()]
    );
    return response;
  });
}
