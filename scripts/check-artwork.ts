/** Audit local card artwork before deploying to Vercel.
 * Reads the project SQLite file; never modifies the database or assets.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, statSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';

const dbFile = resolve(process.env.DATABASE_PATH || 'data/fredou.sqlite');
if (!existsSync(dbFile)) {
  console.error('Base SQLite locale introuvable : ' + dbFile);
  process.exit(1);
}
const db = new DatabaseSync(dbFile, { readOnly: true });
try {
  const cards = db.prepare('SELECT id, image FROM cards').all() as {id:string;image:string}[];
  const missing: {image:string;cards:number}[] = [];
  const refs = new Map<string,number>();
  for (const card of cards) {
    if (!card.image || !card.image.startsWith('/') || card.image.includes('\\') || card.image.split('/').includes('..')) {
      console.error('Chemin image invalide pour : ' + card.id);
      process.exitCode=1;
      continue;
    }
    refs.set(card.image,(refs.get(card.image)||0)+1);
  }
  let present=0;
  for (const [url,cardsCount] of refs) {
    const file=resolve('public', '.' + url);
    if (!file.startsWith(resolve('public')+sep)) {
      console.error('Chemin hors du dossier public : '+url);
      process.exitCode=1;
      continue;
    }
    if (existsSync(file) && statSync(file).isFile() && statSync(file).size>0) present++;
    else missing.push({image:url,cards:cardsCount});
  }
  console.log('Cartes catalogue : '+cards.length);
  console.log('Fichiers illustrations uniques : '+refs.size);
  console.log('Images présentes : '+present);
  console.log('Images manquantes : '+missing.length);
  for (const row of missing.slice(0,30)) console.log('  MANQUANT '+row.image+' (références : '+row.cards+')');
  if (missing.length>30) console.log('  ... et '+(missing.length-30)+' autres.');
  if (missing.length) process.exitCode=1;
} finally { db.close(); }
