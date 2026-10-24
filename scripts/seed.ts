import { getDb,seed } from '../src/server/database';
import { existsSync } from 'node:fs';
for (const path of ['.env.local','.env']) if (existsSync(path)) process.loadEnvFile(path);
const db=getDb();seed(db);
console.log('Données initiales disponibles (initialisation non destructive).');
console.log(db.prepare('SELECT (SELECT COUNT(*) FROM cards) cartes,(SELECT COUNT(*) FROM users) joueurs,(SELECT COUNT(*) FROM series) albums').get());
