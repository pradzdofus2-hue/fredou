import test from 'node:test';
import assert from 'node:assert/strict';
import { retryablePgError } from '../src/server/postgres';

test('PostgreSQL deadlocks and serialization failures are retryable', () => {
  assert.equal(retryablePgError({code:'40P01'}),true);
  assert.equal(retryablePgError({code:'40001'}),true);
});
test('PostgreSQL business, auth and unique key errors are never retried', () => {
  for (const code of ['23505','23503','28P01','42501','57014','08006'])
    assert.equal(retryablePgError({code}),false,code);
  assert.equal(retryablePgError(new Error('insufficient balance')),false);
  assert.equal(retryablePgError(null),false);
});
