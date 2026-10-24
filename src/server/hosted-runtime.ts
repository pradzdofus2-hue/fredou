/** Hosted deployments must never silently fall back to the disposable local SQLite game. */
export function hostedDatabaseUnavailable():boolean {
 return (process.env.VERCEL_ENV==='production'||process.env.VERCEL_ENV==='preview') &&
  (process.env.PG_AUTH_ENABLED!=='true'||process.env.PG_STATE_ENABLED!=='true'||process.env.PG_GAME_ACTIONS_ENABLED!=='true');
}
