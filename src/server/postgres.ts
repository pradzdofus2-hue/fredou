/**
 * PostgreSQL access for the forthcoming asynchronous FREDOU runtime.
 * Deliberately not wired into the current synchronous SQLite engine:
 * switching individual queries would break atomic economy operations.
 *
 * Requires DATABASE_URL and the 'pg' dependency; call from server-only code.
 */
import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const globalPools = globalThis as typeof globalThis & { fredouPostgresPool?: Pool };

function connectionString(): string {
  const value = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!value) throw new Error('FREDOU_POSTGRES_URL_MISSING');
  return value;
}

export function pgPool(): Pool {
  if (!globalPools.fredouPostgresPool) {
    globalPools.fredouPostgresPool = new Pool({
      connectionString: connectionString(),
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      application_name: 'fredou-collection',
    });
  }
  return globalPools.fredouPostgresPool;
}

export async function pgAll<T extends QueryResultRow>(query: string, params: unknown[] = []): Promise<T[]> {
  // Every query uses the private fredou schema, including SELECTs.
  return pgRead<T>(query, params);
}

export async function pgOne<T extends QueryResultRow>(query: string, params: unknown[] = []): Promise<T | undefined> {
  return (await pgAll<T>(query, params))[0];
}

/** One client throughout the transaction; rolls back on every failure. */
export async function pgTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO fredou, public');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Restrict DB namespace to the private game schema for ordinary reads. */
export async function pgRead<T extends QueryResultRow>(query: string, params: unknown[] = []): Promise<T[]> {
  return pgTransaction(async (client) => (await client.query<T>(query, params)).rows);
}
