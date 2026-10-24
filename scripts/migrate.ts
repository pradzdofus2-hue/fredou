import { getDb } from '../src/server/database';
import { existsSync } from 'node:fs';
for (const path of ['.env.local','.env']) if (existsSync(path)) process.loadEnvFile(path);
const db=getDb();
console.log('Schéma SQLite à jour.');
console.log(db.prepare('SELECT version,applied_at FROM migrations').all());
