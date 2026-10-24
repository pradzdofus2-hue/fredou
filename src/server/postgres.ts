/**
 * PostgreSQL access for the forthcoming asynchronous FREDOU runtime.
 * Deliberately not wired into the current synchronous SQLite engine:
 * switching individual queries would break atomic economy operations.
 *
 * Requires DATABASE_URL and the 'pg' dependency; call from server-only code.
 */
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

const testTransaction = new AsyncLocalStorage<PoolClient>();

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

/** SQLSTATEs for transient concurrency conflicts. Never retry business rule errors. */
export function retryablePgError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return error.code === '40P01' || error.code === '40001';
}

/** One client per attempt; each failed transaction is rolled back before retry. */
export async function pgTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const borrowed = testTransaction.getStore();
  // Rollback-only tests run in a single external transaction; never auto-retry there.
  if (borrowed) return callback(borrowed);
  for (let attempt = 0; attempt < 3; attempt++) {
    const client = await pgPool().connect();
    let retry = false;
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL search_path TO fredou, public');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); }
      catch { /* preserve original SQL error */ }
      retry = attempt < 2 && retryablePgError(error);
      if (!retry) throw error;
    } finally {
      client.release();
    }
    if (retry) await sleep(30 * (attempt + 1) + Math.floor(Math.random() * 35));
  }
  throw new Error('POSTGRES_RETRY_EXHAUSTED');
}

/** Restrict DB namespace to the private game schema for ordinary reads. */
export async function pgRead<T extends QueryResultRow>(query: string, params: unknown[] = []): Promise<T[]> {
  return pgTransaction(async (client) => (await client.query<T>(query, params)).rows);
}

/** Execute integration checks in one database transaction, always rolled back.
 * This API should only be called from trusted server-side test scripts.
 */
export async function pgRollbackTest<T>(callback: () => Promise<T>): Promise<T> {
  const client = await pgPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO fredou, public');
    const result = await testTransaction.run(client, callback);
    return result;
  } finally {
    try { await client.query('ROLLBACK'); } finally { client.release(); }
  }
}
