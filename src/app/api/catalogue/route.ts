import { postgresCatalog } from '@/server/postgres-catalog';
import { json } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public cards and series only; never returns player records. */
export async function GET(): Promise<Response> {
  if (process.env.PG_CATALOGUE_ENABLED !== 'true') {
    return json({error: 'Catalogue PostgreSQL non activé.'}, 503);
  }
  try {
    return json(await postgresCatalog());
  } catch {
    return json({error: 'Catalogue temporairement indisponible.'}, 503);
  }
}
