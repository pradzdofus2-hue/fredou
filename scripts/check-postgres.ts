/** Safe PostgreSQL connectivity test. Never prints credentials or row contents. */
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('DATABASE_URL or SUPABASE_DB_URL must be set');
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10000 });
  try {
    const result = await pool.query(
      "SELECT count(*)::integer AS n FROM information_schema.tables WHERE table_schema = 'fredou' AND table_type = 'BASE TABLE'"
    );
    if (result.rows[0]?.n !== 25) throw new Error('Schema fredou incomplet');
    console.log('PostgreSQL OK — 25 tables privées présentes.');
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error('Échec connexion ou vérification PostgreSQL. Vérifie DATABASE_URL et les droits de lecture.');
  process.exitCode = 1;
});
