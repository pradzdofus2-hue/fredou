/** Read-only integration check for the PostgreSQL game runtime. */
import { pgPool, pgTransaction } from '../src/server/postgres';
import { pgState } from '../src/server/postgres-state';

async function main() {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    throw new Error('DATABASE_URL ou SUPABASE_DB_URL absent');
  }
  try {
    const counts = await pgTransaction(async db => {
      await db.query('SET TRANSACTION READ ONLY');
      const tables = await db.query<{n:number}>("SELECT COUNT(*)::integer n FROM information_schema.tables WHERE table_schema='fredou' AND table_type='BASE TABLE'");
      const cards = await db.query<{n:number}>('SELECT COUNT(*)::integer n FROM cards');
      const boosters = await db.query<{id:string;rarities:number}>(
        'SELECT b.id,COUNT(DISTINCT c.rarity)::integer rarities FROM boosters b JOIN cards c ON (b.series_id IS NULL OR c.series_id=b.series_id) GROUP BY b.id');
      return {tables:tables.rows[0].n,cards:cards.rows[0].n,boosters:boosters.rows};
    });
    if (counts.tables!==25 || counts.cards<100 || counts.boosters.length!==5 || counts.boosters.some(b=>b.rarities!==6))
      throw new Error('Catalogue incomplet ou probabilités de boosters impossibles');
    // The game schema is private: no direct API reads/writes from browser roles.
    const exposed=await pgTransaction(async db=>{
      await db.query('SET TRANSACTION READ ONLY');
      const result=await db.query<{table_name:string}>(`SELECT c.relname AS table_name
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='fredou' AND c.relkind IN ('r','p')
          AND (has_table_privilege('anon',c.oid,'SELECT')
            OR has_table_privilege('authenticated',c.oid,'SELECT')
            OR has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE')
            OR has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'))
        ORDER BY c.relname`);
      return result.rows.map(x=>x.table_name);
    });
    if(exposed.length) throw new Error('Permissions directes inattendues pour anon/authenticated sur : '+exposed.join(', '));
    console.log('Sécurité Supabase OK : aucune table privée accessible aux rôles navigateur.');
    // The same DTO builder used by /api/state; validates all SQL reads and field mappings.
    const guest=await pgState(null);
    if (guest.currentUser!==null || guest.inventory.length!==0 || guest.cards.length<100 || guest.boosters.length!==5)
      throw new Error('État invité PostgreSQL invalide');
    console.log('PG runtime OK : '+counts.cards+' cartes, '+counts.boosters.length+' boosters, '+guest.cards.length+' cartes visibles.');
    console.log('État invité vérifié. Aucun compte ni inventaire modifié.');
  } finally {
    await pgPool().end();
  }
}
main().catch(error=>{
  console.error('PG runtime KO : '+(error instanceof Error ? error.message : 'Erreur inconnue'));
  process.exitCode=1;
});
