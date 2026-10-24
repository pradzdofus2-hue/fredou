import 'server-only';
import { pgRead } from './postgres';

export interface PostgresHealth {
  connected: true;
  tableCount: number;
  cardCount: number;
}

/** Internal diagnostic; never publish connection details or query error strings. */
export async function postgresHealth(): Promise<PostgresHealth> {
  const rows = await pgRead<{ table_count: number; card_count: string }>(
    `SELECT
       (SELECT count(*)::integer FROM information_schema.tables
        WHERE table_schema='fredou' AND table_type='BASE TABLE') AS table_count,
       (SELECT count(*)::text FROM cards) AS card_count`
  );
  const row = rows[0];
  if (!row || row.table_count !== 25) throw new Error('FREDOU_POSTGRES_SCHEMA_NOT_READY');
  return { connected: true, tableCount: row.table_count, cardCount: Number(row.card_count) };
}
